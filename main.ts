import { App, Plugin, WorkspaceLeaf, ItemView, TFile, TFolder } from "obsidian";

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

            card.onclick = () => this.app.workspace.openLinkText(file.file!.path, "", true);
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
