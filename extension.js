const vscode = require('vscode');

let todoNotes = [];

/**
 * @param {vscode.ExtensionContext} context 
 */

function activate(context) {
    context.subscriptions.push(
        vscode.commands.registerCommand('todo.addNote', addNote),
        vscode.commands.registerCommand('todo.deleteNote', deleteNote),
        vscode.commands.registerCommand('todo.editNote', editNote)
    );

    const todoProvider = new TodoProvider(context);
    vscode.window.registerTreeDataProvider('todoPanel', todoProvider);

    context.subscriptions.push(
        vscode.commands.registerCommand('todo.refreshPanel', () => todoProvider.refresh())
    );
}

function deactivate() {}

async function addNote() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showErrorMessage('Откройте файл для добавления заметки.');
        return;
    }

    const note = await vscode.window.showInputBox({ prompt: 'Введите текст TODO' });
    if (!note) return;

    const selection = editor.selection;
    const position = selection.active;
    const filePath = editor.document.uri.fsPath;
    const selectedText = editor.document.getText(selection);

    const range = {
        start: { line: selection.start.line, character: selection.start.character },
        end: { line: selection.end.line, character: selection.end.character }
    };

    todoNotes.push({
        filePath,
        position: { line: position.line, character: position.character },
        range,
        text: note,
        selectedText: selectedText || null
    });

    const edit = new vscode.WorkspaceEdit();
    const commentText = `// TODO: ${note}\n`;
    const commentPosition = new vscode.Position(range.start.line, 0);
    edit.insert(editor.document.uri, commentPosition, commentText);
    await vscode.workspace.applyEdit(edit);

    vscode.commands.executeCommand('todo.refreshPanel');
}

async function deleteNote() {
    const noteIndex = await vscode.window.showQuickPick(
        todoNotes.map((note, index) => ({ label: note.text, index })),
        { placeHolder: 'Выберите заметку для удаления' }
    );

    if (noteIndex && typeof noteIndex.index === 'number') {
        todoNotes.splice(noteIndex.index, 1);
        vscode.commands.executeCommand('todo.refreshPanel');
    }
}

async function editNote() {
    const noteIndex = await vscode.window.showQuickPick(
        todoNotes.map((note, index) => ({ label: note.text, index })),
        { placeHolder: 'Выберите заметку для редактирования' }
    );

    if (noteIndex && typeof noteIndex.index === 'number') {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('Откройте файл для изменения заметки.');
            return;
        }

        const newText = await vscode.window.showInputBox({
            prompt: 'Введите новый текст заметки',
            value: todoNotes[noteIndex.index].text,
        });

        if (newText) {
            todoNotes[noteIndex.index].text = newText;
        }

        const selection = editor.selection;
        const selectedText = editor.document.getText(selection);

        todoNotes[noteIndex.index].range = {
            start: { line: selection.start.line, character: selection.start.character },
            end: { line: selection.end.line, character: selection.end.character }
        };

        todoNotes[noteIndex.index].selectedText = selectedText || null;

        const edit = new vscode.WorkspaceEdit();
        const range = todoNotes[noteIndex.index].range;
        const commentPosition = new vscode.Position(range.start.line, 0);
        const commentText = `// TODO: ${newText}\n`;
        edit.replace(
            editor.document.uri,
            new vscode.Range(commentPosition, new vscode.Position(commentPosition.line + 1, 0)),
            commentText
        );
        await vscode.workspace.applyEdit(edit);

        vscode.commands.executeCommand('todo.refreshPanel');
    }
}

class TodoProvider {
    constructor(context) {
        this.context = context;
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    }

    refresh() {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element) {
        return element;
    }

    getChildren() {
        return todoNotes.map((note) => {
            const treeItem = new vscode.TreeItem(note.text, vscode.TreeItemCollapsibleState.None);
            treeItem.command = {
                command: 'vscode.open',
                title: 'Открыть файл',
                arguments: [vscode.Uri.file(note.filePath)],
            };

            if (note.selectedText) {
                treeItem.description = `"${note.selectedText}"`;
            }

            treeItem.command.arguments.push({
                selection: new vscode.Range(
                    new vscode.Position(note.range.start.line, note.range.start.character),
                    new vscode.Position(note.range.end.line, note.range.end.character)
                )
            });

            return treeItem;
        });
    }
}

module.exports = {
    activate,
    deactivate
};

