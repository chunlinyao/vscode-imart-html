/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as path from 'path';
import { ExtensionContext, Uri, workspace, FileSystemWatcher} from 'vscode';

import {
	LanguageClient,
	LanguageClientOptions,
	ServerOptions,
	TransportKind,
	NotificationType
} from 'vscode-languageclient';

let client: LanguageClient;
// eslint-disable-next-line @typescript-eslint/no-namespace
namespace importedFileChange {
	export const type: NotificationType<string> = new NotificationType("html/importedFileChanged");
}

export async function activate(context: ExtensionContext) {
	const root: Uri = workspace.workspaceFolders![0]!.uri;
	let hasJssp: boolean;
	try {
		await workspace.fs.stat(root.with({path: path.posix.join(root.path, 'src/main/jssp')}));
		hasJssp = true;
	} catch {
		hasJssp = false;
	}
	if (!hasJssp) {
		return;
	}
	// The server is implemented in node
	const serverModule = context.asAbsolutePath(
		path.join('server', 'out', 'node', 'htmlServerMain.js')
	);
	// The debug options for the server
	// --inspect=6009: runs the server in Node's Inspector mode so VS Code can attach to the server for debugging
	const debugOptions = { execArgv: ['--nolazy', '--inspect=6009'] };

	// If the extension is launched in debug mode then the debug server options are used
	// Otherwise the run options are used
	const serverOptions: ServerOptions = {
		run: { module: serverModule, transport: TransportKind.ipc },
		debug: {
			module: serverModule,
			transport: TransportKind.ipc,
			options: debugOptions
		}
	};

	// Options to control the language client
	const clientOptions: LanguageClientOptions = {
		// Register the server for plain text documents
		documentSelector: [{ scheme: 'file', language: 'html' }]
	};

	// Create the language client and start the client.
	client = new LanguageClient(
		'languageServerImartHtml',
		'Imart Html',
		serverOptions,
		clientOptions
	);

	const fileWatcher: FileSystemWatcher = workspace.createFileSystemWatcher("**/*.{ts,js}", true, false, true);
	client.onReady().then(() => {
		fileWatcher.onDidChange(e => {
			client.sendNotification(importedFileChange.type, e.toString());
		});
	});
	// Start the client. This will also launch the server
	client.start();
}

export function deactivate(): Thenable<void> | undefined {
	if (!client) {
		return undefined;
	}
	return client.stop();
}
