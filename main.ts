import { App, Plugin, WorkspaceLeaf, ItemView, TFile, TFolder, Modal, Setting } from "obsidian";

const VIEW_TYPE_CARDS = "card-explorer";

// Интерфейс для элементов файловой системы
interface FileSystemItem {
  name: string;
  path: string;
  type: 'file' | 'folder';
  children?: FileSystemItem[];
  isExpanded?: boolean;
  file?: TFile;
  folder?: TFolder;
}

// Интерфейс для действий контекстного меню
interface ContextMenuAction {
  label: string;
  icon: string;
  action: () => void;
  dangerous?: boolean;
}

// Модальное окно для переименования
class RenameModal extends Modal {
  private newName: string;
  private onSubmit: (newName: string) => void;

  constructor(app: App, currentName: string, onSubmit: (newName: string) => void) {
    super(app);
    this.newName = currentName;
    this.onSubmit = onSubmit;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.createEl("h2", { text: "Переименовать" });

    new Setting(contentEl)
      .setName("Новое название")
      .addText(text => {
        text
          .setValue(this.newName)
          .onChange(value => this.newName = value);
        text.inputEl.focus();
        text.inputEl.select();
      });

    new Setting(contentEl)
      .addButton(btn => btn
        .setButtonText("Отмена")
        .onClick(() => this.close())
      )
      .addButton(btn => btn
        .setButtonText("Переименовать")
        .setCta()
        .onClick(() => {
          this.onSubmit(this.newName);
          this.close();
        })
      );
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}

// Модальное окно для создания нового элемента
class CreateModal extends Modal {
  private name: string;
  private onSubmit: (name: string) => void;
  private title: string;
  private placeholder: string;

  constructor(app: App, title: string, placeholder: string, onSubmit: (name: string) => void) {
    super(app);
    this.name = "";
    this.onSubmit = onSubmit;
    this.title = title;
    this.placeholder = placeholder;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.createEl("h2", { text: this.title });

    new Setting(contentEl)
      .setName("Название")
      .addText(text => text
        .setPlaceholder(this.placeholder)
        .onChange(value => this.name = value)
        .inputEl.focus()
      );

    new Setting(contentEl)
      .addButton(btn => btn
        .setButtonText("Отмена")
        .onClick(() => this.close())
      )
      .addButton(btn => btn
        .setButtonText("Создать")
        .setCta()
        .onClick(() => {
          this.onSubmit(this.name);
          this.close();
        })
      );
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}

export default class CardExplorerPlugin extends Plugin {
  /**
   * Инициализация плагина при загрузке
   * Регистрирует новое представление и добавляет иконку в панель инструментов
   */
  async onload() {
    this.registerView(
      VIEW_TYPE_CARDS,
      (leaf) => new CardExplorerView(leaf)
    );

    this.addRibbonIcon("layout-grid", "Open Card Explorer", () => {
      this.activateView();
    });
  }

  /**
   * Активирует представление Card Explorer
   * Открывает новое представление в правой панели и делает его активным
   */
  async activateView() {
    const leaf = this.app.workspace.getRightLeaf(false);
    await leaf.setViewState({ type: VIEW_TYPE_CARDS, active: true });
    this.app.workspace.revealLeaf(leaf);
  }
}

class CardExplorerView extends ItemView {
  private fileSystemData: FileSystemItem[] = [];
  private contextMenu: HTMLElement | null = null;

  /**
   * Конструктор представления Card Explorer
   * @param leaf - лист рабочего пространства для размещения представления
   */
  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
  }

  /**
   * Возвращает тип представления
   * @returns Уникальный идентификатор типа представления
   */
  getViewType() {
    return VIEW_TYPE_CARDS;
  }

  /**
   * Возвращает отображаемое название представления
   * @returns Название для отображения в интерфейсе
   */
  getDisplayText() {
    return "Card Explorer";
  }

  /**
   * Возвращает иконку для представления
   * @returns Название иконки из набора иконок Obsidian
   */
  getIcon() {
    return "layout-grid";
  }

  /**
   * Вызывается при открытии представления
   * Создает единую структуру: папки + карточки файлов в одном дереве
   */
  async onOpen() {
    const container = this.containerEl.children[1];
    container.empty();

    // Загружаем структуру файловой системы
    await this.loadFileSystem();
    
    // Создаем контейнер для единой структуры
    const treeContainer = container.createDiv("unified-tree-container");
    
    // Рендерим единую структуру: папки + карточки файлов
    this.renderUnifiedTree(treeContainer, this.fileSystemData, 0);
  }

  /**
   * Загружает структуру файловой системы из хранилища Obsidian
   */
  private async loadFileSystem() {
    this.fileSystemData = [];
    const rootFolder = this.app.vault.getRoot();
    
    if (rootFolder) {
      await this.buildFileSystemTree(rootFolder, this.fileSystemData);
    }
  }

  /**
   * Рекурсивно строит древовидную структуру файлов и папок
   * @param folder - папка для обработки
   * @param parentArray - массив для добавления элементов
   */
  private async buildFileSystemTree(folder: TFolder, parentArray: FileSystemItem[]) {
    const children = folder.children;
    
    if (!children) return;

    // Сортируем: сначала папки, потом файлы
    const sortedChildren = children.sort((a, b) => {
      if (a instanceof TFolder && b instanceof TFile) return -1;
      if (a instanceof TFile && b instanceof TFolder) return 1;
      return a.name.localeCompare(b.name);
    });

    for (const child of sortedChildren) {
      if (child instanceof TFolder) {
        const folderItem: FileSystemItem = {
          name: child.name,
          path: child.path,
          type: 'folder',
          children: [],
          isExpanded: false,
          folder: child
        };
        
        parentArray.push(folderItem);
        await this.buildFileSystemTree(child, folderItem.children!);
      } else if (child instanceof TFile && child.extension === 'md') {
        const fileItem: FileSystemItem = {
          name: child.basename,
          path: child.path,
          type: 'file',
          file: child
        };
        
        parentArray.push(fileItem);
      }
    }
  }

  /**
   * Рендерит единую структуру: папки + карточки файлов
   * @param container - контейнер для рендеринга
   * @param items - массив элементов для рендеринга
   * @param level - уровень вложенности
   */
  private async renderUnifiedTree(container: HTMLElement, items: FileSystemItem[], level: number) {
    for (const item of items) {
      if (item.type === 'folder') {
        // Рендерим папку
        const folderElement = container.createDiv("folder-container");
        folderElement.style.paddingLeft = `${level * 20}px`;
        await this.renderFolderWithContent(folderElement, item, level);
      }
    }
  }

  /**
   * Рендерит папку с её содержимым: подпапки + карточки файлов
   * @param container - контейнер для папки
   * @param folder - данные папки
   * @param level - уровень вложенности
   */
  private async renderFolderWithContent(container: HTMLElement, folder: FileSystemItem, level: number) {
    // Заголовок папки
    const folderHeader = container.createDiv("folder-header");
    
    // Иконка папки
    const icon = folderHeader.createSpan("folder-icon");
    icon.textContent = folder.isExpanded ? "📂" : "📁";
    
    // Название папки
    const name = folderHeader.createSpan("folder-name");
    name.textContent = folder.name;
    
    // Обработчик клика для раскрытия/сворачивания
    folderHeader.onclick = () => {
      folder.isExpanded = !folder.isExpanded;
      this.refreshView();
    };

    // Обработчик правого клика для контекстного меню
    folderHeader.oncontextmenu = (e) => {
      e.preventDefault();
      console.log("Right click on folder:", folder.name);
      this.showContextMenu(e, folder);
    };

    // Контейнер для содержимого папки
    if (folder.isExpanded && folder.children) {
      const contentContainer = container.createDiv("folder-content");
      
      // Сначала рендерим подпапки
      const subfolders = folder.children.filter(child => child.type === 'folder');
      if (subfolders.length > 0) {
        const subfoldersContainer = contentContainer.createDiv("subfolders-container");
        for (const subfolder of subfolders) {
          const subfolderElement = subfoldersContainer.createDiv("folder-container");
          subfolderElement.style.paddingLeft = `${(level + 1) * 20}px`;
          await this.renderFolderWithContent(subfolderElement, subfolder, level + 1);
        }
      }
      
      // Затем рендерим карточки файлов
      const files = folder.children.filter(child => child.type === 'file');
      if (files.length > 0) {
        const filesContainer = contentContainer.createDiv("files-container");
        const cardsGrid = filesContainer.createDiv("card-grid");
        
    for (const file of files) {
          if (file.file) {
            const content = await this.app.vault.cachedRead(file.file);
      const preview = content.split("\n").slice(0, 3).join(" ");

            const card = cardsGrid.createDiv("card");
            card.createEl("h3", { text: file.name });
      card.createEl("p", { text: preview });

            // Обработчик клика для открытия файла
            card.onclick = () => {
              if (file.file) {
                this.app.workspace.openLinkText(file.file.path, "", true);
              }
            };

            // Обработчик правого клика для контекстного меню
            card.oncontextmenu = (e) => {
              e.preventDefault();
              console.log("Right click on file card:", file.name);
              this.showFileContextMenu(e, file);
            };
          }
        }
      }
    }
  }



  /**
   * Рендерит файл с превью содержимого
   * @param element - HTML элемент для рендеринга
   * @param file - данные файла
   */
  private async renderFile(element: HTMLElement, file: FileSystemItem) {
    const fileHeader = element.createDiv("file-header");
    
    // Иконка файла
    const icon = fileHeader.createSpan("file-icon");
    icon.textContent = "📄";
    
    // Название файла
    const name = fileHeader.createSpan("file-name");
    name.textContent = file.name;

    // Превью содержимого
    if (file.file) {
      try {
        const content = await this.app.vault.cachedRead(file.file);
        const preview = content.split("\n").slice(0, 2).join(" ").substring(0, 100);
        
        const previewElement = element.createDiv("file-preview");
        previewElement.textContent = preview + (preview.length >= 100 ? "..." : "");
      } catch (error) {
        console.error("Ошибка чтения файла:", error);
      }
    }

    // Обработчик клика для открытия файла
    fileHeader.onclick = () => {
      if (file.file) {
        this.app.workspace.openLinkText(file.file.path, "", true);
      }
    };

    // Обработчик правого клика для контекстного меню
    fileHeader.oncontextmenu = (e) => {
      e.preventDefault();
      console.log("Right click on file header:", file.name);
      this.showFileContextMenu(e, file);
    };

    // Также добавляем обработчик к самой карточке файла
    element.oncontextmenu = (e) => {
      e.preventDefault();
      console.log("Right click on file card:", file.name);
      this.showFileContextMenu(e, file);
    };
  }

  /**
   * Показывает контекстное меню для файла
   * @param event - событие мыши
   * @param file - файл для которого показывается меню
   */
  private showFileContextMenu(event: MouseEvent, file: FileSystemItem) {
    console.log("showFileContextMenu called for file:", file.name);
    // Скрываем предыдущее меню если есть
    this.hideContextMenu();

    // Создаем контекстное меню
    this.contextMenu = this.containerEl.createDiv("context-menu");
    this.contextMenu.style.position = "fixed";
    
    // Получаем координаты относительно viewport
    const x = event.clientX;
    const y = event.clientY;

    // Получаем действия для файла
    const actions = this.getFileActions(file);

    // Создаем элементы меню
    actions.forEach(action => {
      const menuItem = this.contextMenu!.createDiv("context-menu-item");
      if (action.dangerous) {
        menuItem.addClass("dangerous");
      }

      const icon = menuItem.createSpan("context-menu-icon");
      icon.textContent = action.icon;

      const label = menuItem.createSpan("context-menu-label");
      label.textContent = action.label;

      menuItem.onclick = () => {
        action.action();
        this.hideContextMenu();
      };
    });

    // Позиционируем меню с учетом границ экрана
    this.positionContextMenu(this.contextMenu, x, y);

    // Обработчик клика вне меню для его скрытия
    setTimeout(() => {
      document.addEventListener('click', this.hideContextMenu.bind(this), { once: true });
    }, 0);
  }

  /**
   * Показывает контекстное меню для папки
   * @param event - событие мыши
   * @param folder - папка для которой показывается меню
   */
  private showContextMenu(event: MouseEvent, folder: FileSystemItem) {
    // Скрываем предыдущее меню если есть
    this.hideContextMenu();

    // Создаем контекстное меню
    this.contextMenu = this.containerEl.createDiv("context-menu");
    this.contextMenu.style.position = "fixed";
    
    // Получаем координаты относительно viewport
    const x = event.clientX;
    const y = event.clientY;

    // Получаем действия для папки
    const actions = this.getFolderActions(folder);

    // Создаем элементы меню
    actions.forEach(action => {
      const menuItem = this.contextMenu!.createDiv("context-menu-item");
      if (action.dangerous) {
        menuItem.addClass("dangerous");
      }

      const icon = menuItem.createSpan("context-menu-icon");
      icon.textContent = action.icon;

      const label = menuItem.createSpan("context-menu-label");
      label.textContent = action.label;

      menuItem.onclick = () => {
        action.action();
        this.hideContextMenu();
      };
    });

    // Позиционируем меню с учетом границ экрана
    this.positionContextMenu(this.contextMenu, x, y);

    // Обработчик клика вне меню для его скрытия
    setTimeout(() => {
      document.addEventListener('click', this.hideContextMenu.bind(this), { once: true });
    }, 0);
  }

  /**
   * Скрывает контекстное меню
   */
  private hideContextMenu() {
    if (this.contextMenu) {
      this.contextMenu.remove();
      this.contextMenu = null;
    }
  }

  /**
   * Позиционирует контекстное меню с учетом границ экрана
   * @param menu - элемент контекстного меню
   * @param x - координата X клика
   * @param y - координата Y клика
   */
  private positionContextMenu(menu: HTMLElement, x: number, y: number) {
    // Получаем размеры экрана
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    
    // Получаем размеры меню (после его создания)
    const menuRect = menu.getBoundingClientRect();
    const menuWidth = menuRect.width || 180; // fallback к минимальной ширине
    const menuHeight = menuRect.height || 200; // fallback к примерной высоте
    
    // Вычисляем финальные координаты
    let finalX = x;
    let finalY = y;
    
    // Проверяем, не выходит ли меню за правую границу
    if (x + menuWidth > screenWidth) {
      finalX = x - menuWidth;
    }
    
    // Проверяем, не выходит ли меню за нижнюю границу
    if (y + menuHeight > screenHeight) {
      finalY = y - menuHeight;
    }
    
    // Устанавливаем позицию
    menu.style.left = `${finalX}px`;
    menu.style.top = `${finalY}px`;
  }

  /**
   * Получает действия для файла
   * @param file - файл для которого получаем действия
   * @returns массив действий
   */
  private getFileActions(file: FileSystemItem): ContextMenuAction[] {
    return [
      {
        label: "Открыть файл",
        icon: "📖",
        action: () => this.openFile(file)
      },
      {
        label: "Переименовать",
        icon: "✏️",
        action: () => this.renameFile(file)
      },
      {
        label: "Дублировать",
        icon: "📋",
        action: () => this.duplicateFile(file)
      },
      {
        label: "Переместить",
        icon: "📁",
        action: () => this.moveFile(file)
      },
      {
        label: "Удалить файл",
        icon: "🗑️",
        action: () => this.deleteFile(file),
        dangerous: true
      }
    ];
  }

  /**
   * Получает действия для папки
   * @param folder - папка для которой получаем действия
   * @returns массив действий
   */
  private getFolderActions(folder: FileSystemItem): ContextMenuAction[] {
    return [
      {
        label: "Переименовать",
        icon: "✏️",
        action: () => this.renameFolder(folder)
      },
      {
        label: "Открыть в Finder",
        icon: "📁",
        action: () => this.openInFinder(folder)
      },
      {
        label: "Создать папку",
        icon: "📂",
        action: () => this.createNewFolder(folder)
      },
      {
        label: "Создать файл",
        icon: "📄",
        action: () => this.createNewFile(folder)
      },
      {
        label: "Удалить папку",
        icon: "🗑️",
        action: () => this.deleteFolder(folder),
        dangerous: true
      }
    ];
  }

  /**
   * Переименовывает папку
   * @param folder - папка для переименования
   */
  private async renameFolder(folder: FileSystemItem) {
    new RenameModal(this.app, folder.name, async (newName) => {
      if (newName && newName !== folder.name && newName.trim()) {
        try {
          const newPath = folder.path.replace(folder.name, newName.trim());
          await this.app.vault.rename(folder.folder!, newPath);
          this.refreshView();
        } catch (error) {
          console.error("Ошибка переименования папки:", error);
          alert("Не удалось переименовать папку");
        }
      }
    }).open();
  }

  /**
   * Открывает папку в Finder/Explorer
   * @param folder - папка для открытия
   */
  private openInFinder(folder: FileSystemItem) {
    // Показываем путь к папке пользователю
    if (folder.folder) {
      const message = `Путь к папке: ${folder.folder.path}\n\nСкопируйте этот путь и откройте в файловом менеджере.`;
      alert(message);
      
      // Пытаемся скопировать путь в буфер обмена
      if (navigator.clipboard) {
        navigator.clipboard.writeText(folder.folder.path).catch(() => {
          console.log("Не удалось скопировать путь в буфер обмена");
        });
      }
    }
  }

  /**
   * Создает новую папку
   * @param parentFolder - родительская папка
   */
  private async createNewFolder(parentFolder: FileSystemItem) {
    new CreateModal(this.app, "Создать папку", "Название папки", async (folderName) => {
      if (folderName && folderName.trim()) {
        try {
          const newPath = `${parentFolder.path}/${folderName.trim()}`;
          await this.app.vault.createFolder(newPath);
          this.refreshView();
        } catch (error) {
          console.error("Ошибка создания папки:", error);
          alert("Не удалось создать папку");
        }
      }
    }).open();
  }

  /**
   * Создает новый файл
   * @param parentFolder - родительская папка
   */
  private async createNewFile(parentFolder: FileSystemItem) {
    new CreateModal(this.app, "Создать файл", "Название файла (с .md)", async (fileName) => {
      if (fileName && fileName.trim()) {
        try {
          const fileNameWithExt = fileName.endsWith('.md') ? fileName : `${fileName}.md`;
          const newPath = `${parentFolder.path}/${fileNameWithExt}`;
          await this.app.vault.create(newPath, "");
          this.refreshView();
        } catch (error) {
          console.error("Ошибка создания файла:", error);
          alert("Не удалось создать файл");
        }
      }
    }).open();
  }

  /**
   * Удаляет папку
   * @param folder - папка для удаления
   */
  private async deleteFolder(folder: FileSystemItem) {
    const confirmed = confirm(`Вы уверены, что хотите удалить папку "${folder.name}" и все её содержимое?`);
    if (confirmed) {
      try {
        await this.app.vault.delete(folder.folder!);
        this.refreshView();
      } catch (error) {
        console.error("Ошибка удаления папки:", error);
        alert("Не удалось удалить папку");
      }
    }
  }

  /**
   * Открывает файл
   * @param file - файл для открытия
   */
  private openFile(file: FileSystemItem) {
    if (file.file) {
      this.app.workspace.openLinkText(file.file.path, "", true);
    }
  }

  /**
   * Переименовывает файл
   * @param file - файл для переименования
   */
  private async renameFile(file: FileSystemItem) {
    new RenameModal(this.app, file.name, async (newName) => {
      if (newName && newName !== file.name && newName.trim()) {
        try {
          const newPath = file.path.replace(file.name, newName.trim());
          await this.app.vault.rename(file.file!, newPath);
          this.refreshView();
        } catch (error) {
          console.error("Ошибка переименования файла:", error);
          alert("Не удалось переименовать файл");
        }
      }
    }).open();
  }

  /**
   * Дублирует файл
   * @param file - файл для дублирования
   */
  private async duplicateFile(file: FileSystemItem) {
    if (file.file) {
      try {
        const content = await this.app.vault.cachedRead(file.file);
        const newName = `${file.name} (копия)`;
        const newPath = file.path.replace(file.name, newName);
        await this.app.vault.create(newPath, content);
        this.refreshView();
      } catch (error) {
        console.error("Ошибка дублирования файла:", error);
        alert("Не удалось дублировать файл");
      }
    }
  }

  /**
   * Перемещает файл
   * @param file - файл для перемещения
   */
  private async moveFile(file: FileSystemItem) {
    new CreateModal(this.app, "Переместить файл", "Новый путь", async (newPath) => {
      if (newPath && newPath !== file.path && newPath.trim()) {
        try {
          await this.app.vault.rename(file.file!, newPath.trim());
          this.refreshView();
        } catch (error) {
          console.error("Ошибка перемещения файла:", error);
          alert("Не удалось переместить файл");
        }
      }
    }).open();
  }

  /**
   * Удаляет файл
   * @param file - файл для удаления
   */
  private async deleteFile(file: FileSystemItem) {
    const confirmed = confirm(`Вы уверены, что хотите удалить файл "${file.name}"?`);
    if (confirmed) {
      try {
        await this.app.vault.delete(file.file!);
        this.refreshView();
      } catch (error) {
        console.error("Ошибка удаления файла:", error);
        alert("Не удалось удалить файл");
      }
    }
  }

  /**
   * Обновляет представление (перерисовывает всю структуру)
   */
  private async refreshView() {
    const container = this.containerEl.children[1];
    container.empty();
    
    // Создаем контейнер для единой структуры
    const treeContainer = container.createDiv("unified-tree-container");
    
    // Рендерим единую структуру: папки + карточки файлов
    this.renderUnifiedTree(treeContainer, this.fileSystemData, 0);
  }

  /**
   * Вызывается при закрытии представления
   * Очищает ресурсы при необходимости
   */
  async onClose() {
    // очищаем ресурсы если нужно
  }
}
