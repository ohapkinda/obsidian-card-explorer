import { App, Plugin, WorkspaceLeaf, ItemView, TFile, TFolder, Modal, Setting, Menu, Notice } from "obsidian";

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
    contentEl.createEl("h2", { text: "Rename" });

    new Setting(contentEl)
      .setName("New name")
      .addText(text => {
        text
          .setValue(this.newName)
          .onChange(value => this.newName = value);
        text.inputEl.focus();
        text.inputEl.select();
      });

    new Setting(contentEl)
      .addButton(btn => btn
        .setButtonText("Cancel")
        .onClick(() => this.close())
      )
      .addButton(btn => btn
        .setButtonText("Rename")
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
      .setName("Name")
      .addText(text => text
        .setPlaceholder(this.placeholder)
        .onChange(value => this.name = value)
        .inputEl.focus()
      );

    new Setting(contentEl)
      .addButton(btn => btn
        .setButtonText("Cancel")
        .onClick(() => this.close())
      )
      .addButton(btn => btn
        .setButtonText("Create")
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

    this.addRibbonIcon("layout-grid", "Open Cards Explorer", () => {
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
  private expandedFolders: Set<string> = new Set();
  private folderColors: Map<string, string> = new Map();

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
    return "Cards Explorer";
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
          isExpanded: this.expandedFolders.has(child.path),
          folder: child
        };
        
        parentArray.push(folderItem);
        await this.buildFileSystemTree(child, folderItem.children!);
      } else if (child instanceof TFile) {
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
        folderElement.setAttribute('data-level', level.toString());
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
      
      // Сохраняем состояние в Set
      if (folder.isExpanded) {
        this.expandedFolders.add(folder.path);
      } else {
        this.expandedFolders.delete(folder.path);
      }
      
      this.refreshView();
    };

    // Обработчик правого клика для контекстного меню
    folderHeader.oncontextmenu = (e) => {
      e.preventDefault();
      this.showContextMenu(e, folder);
    };

    // Контейнер для содержимого папки
    if (folder.isExpanded && folder.children) {
      const contentContainer = container.createDiv("folder-content");
      
      // Сначала рендерим подпапки
      const subfolders = folder.children.filter(child => child.type === 'folder');
      if (subfolders.length > 0) {
        const subfoldersContainer = contentContainer.createDiv("subfolders-container");
        
        // Добавляем класс для стилизации подпапок
        subfoldersContainer.addClass("subfolders-with-border");
        
        for (const subfolder of subfolders) {
          const subfolderElement = subfoldersContainer.createDiv("folder-container");
          subfolderElement.setAttribute('data-level', (level + 1).toString());
          await this.renderFolderWithContent(subfolderElement, subfolder, level + 1);
        }
      }
      
      // Затем рендерим карточки файлов
      const files = folder.children.filter(child => child.type === 'file');
      if (files.length > 0) {
        const filesContainer = contentContainer.createDiv("files-container");
        
        // Карточки на всю ширину
        const cardsGrid = filesContainer.createDiv("card-grid-full-width");
        
        // Добавляем класс для стилизации карточек файлов
        cardsGrid.addClass("cards-with-border");
        
        for (const file of files) {
          if (file.file) {
            const card = cardsGrid.createDiv("card");
            
            // Показываем иконку файла в зависимости от типа
            const fileIcon = this.getFileIcon(file.file.extension);
            card.createEl("h3", { text: `${fileIcon} ${file.name}` });
            
            // Показываем превью только для текстовых файлов
            if (this.isTextFile(file.file.extension)) {
              try {
                const content = await this.app.vault.cachedRead(file.file);
                const preview = content.split("\n").slice(0, 3).join(" ");
                card.createEl("p", { text: preview });
              } catch (error) {
                card.createEl("p", { text: "Failed to read file" });
              }
            } else {
              card.createEl("p", { text: `${file.file.extension.toUpperCase()} file` });
            }

            // Обработчик клика для открытия файла
            card.onclick = (e) => {
              if (file.file) {
                this.openFileInSystem(file.file, e);
              }
            };

            // Обработчик правого клика для контекстного меню
            card.oncontextmenu = (e) => {
              e.preventDefault();
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
      this.showFileContextMenu(e, file);
    };

    // Также добавляем обработчик к самой карточке файла
    element.oncontextmenu = (e) => {
      e.preventDefault();
      this.showFileContextMenu(e, file);
    };
  }

  /**
   * Показывает контекстное меню для файла
   * @param event - событие мыши
   * @param file - файл для которого показывается меню
   */
  private showFileContextMenu(event: MouseEvent, file: FileSystemItem) {
    const menu = new Menu();
    
    // Add actions for file
    menu.addItem((item) => {
      item.setTitle("Open file")
        .setIcon("file-text")
        .onClick(() => this.openFile(file));
    });
    
    menu.addItem((item) => {
      item.setTitle("Rename")
        .setIcon("edit")
        .onClick(() => this.renameFile(file));
    });
    
    menu.addItem((item) => {
      item.setTitle("Duplicate")
        .setIcon("copy")
        .onClick(() => this.duplicateFile(file));
    });
    
    menu.addItem((item) => {
      item.setTitle("Move")
        .setIcon("folder")
        .onClick(() => this.moveFile(file));
    });
    
    menu.addSeparator();
    
    menu.addItem((item) => {
      item.setTitle("Delete file")
        .setIcon("trash")
        .onClick(() => this.deleteFile(file));
    });
    
    // Показываем меню в позиции курсора
    menu.showAtPosition({ x: event.clientX, y: event.clientY });
  }

  /**
   * Показывает контекстное меню для папки
   * @param event - событие мыши
   * @param folder - папка для которой показывается меню
   */
  private showContextMenu(event: MouseEvent, folder: FileSystemItem) {
    const menu = new Menu();
    
    // Add actions for folder
    menu.addItem((item) => {
      item.setTitle("Rename")
        .setIcon("edit")
        .onClick(() => this.renameFolder(folder));
    });
    
    menu.addSeparator();
    
    menu.addItem((item) => {
      item.setTitle("Create folder")
        .setIcon("folder-plus")
        .onClick(() => this.createNewFolder(folder));
    });
    
    menu.addItem((item) => {
      item.setTitle("Create file")
        .setIcon("file-plus")
        .onClick(() => this.createNewFile(folder));
    });
    
    menu.addSeparator();
    
    menu.addItem((item) => {
      item.setTitle("Delete folder")
        .setIcon("trash")
        .onClick(() => this.deleteFolder(folder));
    });
    
    // Показываем меню в позиции курсора
    menu.showAtPosition({ x: event.clientX, y: event.clientY });
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
          alert("Failed to rename folder");
        }
      }
    }).open();
  }


  /**
   * Создает новую папку
   * @param parentFolder - родительская папка
   */
  private async createNewFolder(parentFolder: FileSystemItem) {
    new CreateModal(this.app, "Create folder", "Folder name", async (folderName) => {
      if (folderName && folderName.trim()) {
        try {
          const newPath = `${parentFolder.path}/${folderName.trim()}`;
          await this.app.vault.createFolder(newPath);
          this.refreshView();
        } catch (error) {
          console.error("Ошибка создания папки:", error);
          alert("Failed to create folder");
        }
      }
    }).open();
  }

  /**
   * Создает новый файл
   * @param parentFolder - родительская папка
   */
  private async createNewFile(parentFolder: FileSystemItem) {
    new CreateModal(this.app, "Create file", "File name (with .md)", async (fileName) => {
      if (fileName && fileName.trim()) {
        try {
          const fileNameWithExt = fileName.endsWith('.md') ? fileName : `${fileName}.md`;
          const newPath = `${parentFolder.path}/${fileNameWithExt}`;
          await this.app.vault.create(newPath, "");
          this.refreshView();
        } catch (error) {
          console.error("Ошибка создания файла:", error);
          alert("Failed to create file");
        }
      }
    }).open();
  }

  /**
   * Удаляет папку
   * @param folder - папка для удаления
   */
  private async deleteFolder(folder: FileSystemItem) {
    const confirmed = confirm(`Are you sure you want to delete folder "${folder.name}" and all its contents?`);
    if (confirmed) {
      try {
        await this.app.fileManager.trashFile(folder.folder!);
        this.refreshView();
      } catch (error) {
        console.error("Ошибка удаления папки:", error);
        alert("Failed to delete folder");
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
          alert("Failed to rename file");
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
        const newName = `${file.name} (copy)`;
        const newPath = file.path.replace(file.name, newName);
        await this.app.vault.create(newPath, content);
        this.refreshView();
      } catch (error) {
        console.error("Ошибка дублирования файла:", error);
        alert("Failed to duplicate file");
      }
    }
  }

  /**
   * Перемещает файл
   * @param file - файл для перемещения
   */
  private async moveFile(file: FileSystemItem) {
    new CreateModal(this.app, "Move file", "New path", async (newPath) => {
      if (newPath && newPath !== file.path && newPath.trim()) {
        try {
          await this.app.vault.rename(file.file!, newPath.trim());
          this.refreshView();
        } catch (error) {
          console.error("Ошибка перемещения файла:", error);
          alert("Failed to move file");
        }
      }
    }).open();
  }

  /**
   * Удаляет файл
   * @param file - файл для удаления
   */
  private async deleteFile(file: FileSystemItem) {
    const confirmed = confirm(`Are you sure you want to delete file "${file.name}"?`);
    if (confirmed) {
      try {
        await this.app.fileManager.trashFile(file.file!);
        this.refreshView();
      } catch (error) {
        console.error("Ошибка удаления файла:", error);
        alert("Failed to delete file");
      }
    }
  }

  /**
   * Получает цвет для папки (генерирует или возвращает существующий)
   * @param folderPath - путь к папке
   * @returns цвет в формате CSS
   */
  private getFolderColor(folderPath: string): string {
    if (!this.folderColors.has(folderPath)) {
      // Генерируем цвет на основе хеша пути
      const colors = [
        '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
        '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
        '#F8C471', '#82E0AA', '#F1948A', '#85C1E9', '#D7BDE2'
      ];
      const hash = folderPath.split('').reduce((a, b) => {
        a = ((a << 5) - a) + b.charCodeAt(0);
        return a & a;
      }, 0);
      const colorIndex = Math.abs(hash) % colors.length;
      this.folderColors.set(folderPath, colors[colorIndex]);
    }
    return this.folderColors.get(folderPath)!;
  }

  /**
   * Определяет, является ли файл текстовым
   * @param extension - расширение файла
   * @returns true если файл текстовый
   */
  private isTextFile(extension: string): boolean {
    const textExtensions = ['md', 'txt', 'json', 'js', 'ts', 'css', 'html', 'xml', 'yaml', 'yml', 'csv', 'log'];
    return textExtensions.indexOf(extension.toLowerCase()) !== -1;
  }

  /**
   * Получает иконку для файла в зависимости от его типа
   * @param extension - расширение файла
   * @returns иконка в виде эмодзи
   */
  private getFileIcon(extension: string): string {
    const ext = extension.toLowerCase();
    const iconMap: { [key: string]: string } = {
      'md': '📝',
      'txt': '📄',
      'pdf': '📕',
      'doc': '📘',
      'docx': '📘',
      'xls': '📊',
      'xlsx': '📊',
      'ppt': '📋',
      'pptx': '📋',
      'jpg': '🖼️',
      'jpeg': '🖼️',
      'png': '🖼️',
      'gif': '🖼️',
      'svg': '🖼️',
      'mp4': '🎬',
      'avi': '🎬',
      'mov': '🎬',
      'mp3': '🎵',
      'wav': '🎵',
      'zip': '📦',
      'rar': '📦',
      '7z': '📦',
      'js': '📜',
      'ts': '📜',
      'css': '🎨',
      'html': '🌐',
      'json': '📋',
      'xml': '📋',
      'yaml': '📋',
      'yml': '📋',
      'csv': '📊',
      'log': '📋'
    };
    return iconMap[ext] || '📄';
  }

  /**
   * Открывает файл в системном приложении по умолчанию
   * @param file - файл для открытия
   * @param event - событие клика для определения модификаторов
   */
  private openFileInSystem(file: TFile, event?: MouseEvent) {
    // Для Obsidian файлов (.md) открываем в Obsidian
    if (file.extension === 'md') {
      // Проверяем, нажат ли Cmd (Mac) или Ctrl (Windows/Linux)
      const openInNewTab = event && (event.metaKey || event.ctrlKey);
      this.app.workspace.openLinkText(file.path, "", openInNewTab);
    } else {
      // Для остальных файлов пытаемся открыть напрямую
      this.openFileDirectly(file);
    }
  }

  /**
   * Открывает файл напрямую в системном приложении
   * @param file - файл для открытия
   */
  private openFileDirectly(file: TFile) {
    try {
      // Используем встроенный API Obsidian для открытия файла
      // Это тот же механизм, что использует обычный файловый менеджер
      this.app.workspace.openLinkText(file.path, "", true);
      
    } catch (error) {
      console.error("Ошибка открытия файла:", error);
      // В случае ошибки показываем путь
      this.showFilePath(file);
    }
  }

  /**
   * Показывает путь к файлу и копирует в буфер обмена
   * @param file - файл
   */
  private showFilePath(file: TFile) {
    const message = `File: ${file.path}\n\nCopy this path and open in system application.`;
    alert(message);
    
    // Пытаемся скопировать путь в буфер обмена
    if (navigator.clipboard) {
      navigator.clipboard.writeText(file.path).catch(() => {
        // Тихо игнорируем ошибку копирования
      });
    }
  }

  /**
   * Обновляет представление (перерисовывает всю структуру)
   */
  private async refreshView() {
    // Перезагружаем данные из файловой системы
    await this.loadFileSystem();
    
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
