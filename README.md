# Card Explorer - Obsidian Plugin

A unified file explorer plugin for Obsidian with card previews and tree structure.

## Features

- **Unified Tree Structure** - Folders and file cards displayed in a single interface
- **Expandable Folders** - Click on folders to show subfolders first, then file cards
- **Card Interface** - Files displayed as adaptive grid cards
- **Content Preview** - Shows first 3 lines of each file as preview
- **Context Menu** - Right-click on folders for file manager actions
- **Quick Access** - Click on cards to open corresponding files
- **Toolbar Icon** - Adds "layout-grid" button for quick access to the view

## Installation

### Manual Installation

1. Download the latest release from the [releases page](https://github.com/ohapkinda/obsidian-card-explorer/releases)
2. Extract the files to your Obsidian vault's `.obsidian/plugins/obsidian-card-explorer/` folder
3. Enable the plugin in Obsidian's Community Plugins settings

### Development Installation

1. Clone this repository
2. Install dependencies: `npm install`
3. Build the plugin: `npm run build`
4. Copy the built files to your Obsidian plugins folder:
   ```bash
   cp main.js manifest.json styles.css /path/to/your/vault/.obsidian/plugins/obsidian-card-explorer/
   ```

## Usage

1. Click the "layout-grid" icon in the toolbar to open Card Explorer
2. The plugin will open in the right panel showing your vault's file structure
3. Click on folders to expand/collapse them
4. Click on file cards to open them in Obsidian
5. Right-click on folders for context menu actions:
   - **Rename** - Change folder name
   - **Create folder** - Create new subfolder
   - **Create file** - Create new .md file
   - **Delete folder** - Remove folder and all contents

## Context Menu Actions

### For Folders:
- ✏️ **Rename** - Change folder name with validation
- 📂 **Create folder** - Create new folder inside selected folder
- 📄 **Create file** - Create new .md file in folder
- 🗑️ **Delete folder** - Delete with confirmation (dangerous action)

### For Files:
- 📄 **Open file** - Open file in Obsidian
- ✏️ **Rename** - Change file name
- 📋 **Duplicate** - Create copy of file
- 📁 **Move** - Move file to different location
- 🗑️ **Delete file** - Remove file with confirmation

## Technical Details

- **Language**: TypeScript
- **Build System**: Rollup with TypeScript compiler
- **Styles**: CSS with CSS Grid layout
- **API**: Official Obsidian API
- **Minimum Obsidian Version**: 1.4.0

## Development

### Prerequisites
- Node.js
- npm

### Build Commands
```bash
npm install          # Install dependencies
npm run build        # Build the plugin
```

### Project Structure
```
obsidian-card-explorer/
├── main.ts              # Main plugin logic (TypeScript)
├── main.js              # Compiled version
├── styles.css           # Styles for card interface
├── manifest.json        # Plugin metadata for Obsidian
├── package.json         # Dependencies and build scripts
├── rollup.config.mjs    # Build configuration
├── tsconfig.json        # TypeScript configuration
└── README.md            # This file
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

If you encounter any issues or have feature requests, please open an issue on the [GitHub repository](https://github.com/ohapkinda/obsidian-card-explorer/issues).

## Changelog

### Version 0.0.1
- Initial release
- Unified tree structure with folders and file cards
- Context menu with file manager actions
- English interface for international users
- Card preview with content snippets
