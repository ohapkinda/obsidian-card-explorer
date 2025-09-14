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
   * Создает древовидную структуру файлов и папок
   */
  async onOpen() {
    const container = this.containerEl.children[1];
    container.empty();

    // Загружаем структуру файловой системы
    await this.loadFileSystem();
    
    // Создаем контейнер для древовидной структуры
    const treeContainer = container.createDiv("file-tree-container");
    
    // Рендерим древовидную структуру
    this.renderFileTree(treeContainer, this.fileSystemData, 0);
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
   * Рендерит древовидную структуру файлов и папок
   * @param container - контейнер для рендеринга
   * @param items - массив элементов для рендеринга
   * @param level - уровень вложенности
   */
  private renderFileTree(container: HTMLElement, items: FileSystemItem[], level: number) {
    for (const item of items) {
      const itemElement = container.createDiv("tree-item");
      itemElement.style.paddingLeft = `${level * 20}px`;

      if (item.type === 'folder') {
        this.renderFolder(itemElement, item, level);
      } else {
        this.renderFile(itemElement, item);
      }
    }
  }

  /**
   * Рендерит папку с возможностью раскрытия/сворачивания
   * @param element - HTML элемент для рендеринга
   * @param folder - данные папки
   * @param level - уровень вложенности
   */
  private renderFolder(element: HTMLElement, folder: FileSystemItem, level: number) {
    const folderHeader = element.createDiv("folder-header");
    
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
      const childrenContainer = element.createDiv("folder-children");
      this.renderFileTree(childrenContainer, folder.children, level + 1);
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
    
    const treeContainer = container.createDiv("file-tree-container");
    this.renderFileTree(treeContainer, this.fileSystemData, 0);
  }

  /**
   * Вызывается при закрытии представления
   * Очищает ресурсы при необходимости
   */
  async onClose() {
    // очищаем ресурсы если нужно
  }
}
