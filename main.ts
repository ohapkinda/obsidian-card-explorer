import { App, Plugin, WorkspaceLeaf, ItemView, TFile } from "obsidian";

const VIEW_TYPE_CARDS = "card-explorer";

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
   * Создает сетку карточек со всеми markdown файлами и их превью
   */
  async onOpen() {
    const container = this.containerEl.children[1];
    container.empty();

    const grid = container.createDiv("card-grid");

    const files = this.app.vault.getMarkdownFiles();
    for (const file of files) {
      const content = await this.app.vault.cachedRead(file);
      const preview = content.split("\n").slice(0, 3).join(" ");

      const card = grid.createDiv("card");
      card.createEl("h3", { text: file.basename });
      card.createEl("p", { text: preview });

      card.onclick = () => this.app.workspace.openLinkText(file.path, "", true);
    }
  }

  /**
   * Вызывается при закрытии представления
   * Очищает ресурсы при необходимости
   */
  async onClose() {
    // очищаем ресурсы если нужно
  }
}
