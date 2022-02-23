# Imart Html extenson

Additional support for imart tags and Javascript library.

## Functionality

This extension activate additional LSP when there is `src/main/jssp` folder.

This Language Server works for `html` file with below functionalities:

- Completions for `<imart>` HTML tags
- Completions for Imui JS in `<script>` tag

## Running the Sample

- Run `npm install` in this folder. This installs all necessary npm modules in both the client and server folder
- Open VS Code on this folder.
- Press Ctrl+Shift+B to compile the client and server.
- Switch to the Debug viewlet.
- Select `Launch Client` from the drop down.
- Run the launch config.
- If you want to debug the server as well use the launch configuration `Attach to Server`
- In the [Extension Development Host] instance of VSCode, open a HTML document
  - Type `<d|` to try HTML completion
  - Type `<script>Imui|</script>` to try JS completion
  - Have `<script>ImuiBigDecimal</script>` to see JS Diagnostics

## ChangeLog

- 1.0.1
  - 自动补全列表bug修复。修复后会出现重复提示。