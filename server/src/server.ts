/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import {
	CompletionList,
	createConnection,
	Diagnostic,
	InitializeParams,
	ProposedFeatures,
	TextDocuments,
	TextDocumentSyncKind,
	WorkspaceFolder
} from 'vscode-languageserver';
import { getLanguageModes, LanguageModes } from './languageModes';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { URI } from 'vscode-uri';

// Create a connection for the server. The connection uses Node's IPC as a transport.
// Also include all preview / proposed LSP features.
const connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager. The text document manager
// supports full document sync only
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

let workspaceFolders: WorkspaceFolder[] = [];
let languageModes: LanguageModes;
let clientSnippetSupport = false;
let dynamicFormatterRegistration = false;
let scopedSettingsSupport = false;
let workspaceFoldersSupport = false;
let foldingRangeLimit = Number.MAX_VALUE;

connection.onInitialize((_params: InitializeParams) => {
	const initializationOptions = _params.initializationOptions;

		workspaceFolders = (<any>_params).workspaceFolders;
		if (!Array.isArray(workspaceFolders)) {
			workspaceFolders = [];
			if (_params.rootPath) {
				workspaceFolders.push({ name: '', uri: URI.file(_params.rootPath).toString() });
			}
		}

		const workspace = {
			get settings() { return {javascript: true, css: false, html: false}; },
			get folders() { return workspaceFolders; }
		};
	languageModes = getLanguageModes(workspace);

	documents.onDidClose(e => {
		languageModes.onDocumentRemoved(e.document);
	});
	connection.onShutdown(() => {
		languageModes.dispose();
	});

	function getClientCapability<T>(name: string, def: T) {
		const keys = name.split('.');
		let c: any = _params.capabilities;
		for (let i = 0; c && i < keys.length; i++) {
			// eslint-disable-next-line no-prototype-builtins
			if (!c.hasOwnProperty(keys[i])) {
				return def;
			}
			c = c[keys[i]];
		}
		return c;
	}

	clientSnippetSupport = getClientCapability('textDocument.completion.completionItem.snippetSupport', false);
		dynamicFormatterRegistration = getClientCapability('textDocument.rangeFormatting.dynamicRegistration', false) && (typeof initializationOptions?.provideFormatter !== 'boolean');
		scopedSettingsSupport = getClientCapability('workspace.configuration', false);
		workspaceFoldersSupport = getClientCapability('workspace.workspaceFolders', false);
		foldingRangeLimit = getClientCapability('textDocument.foldingRange.rangeLimit', Number.MAX_VALUE);
		const capabilities: ServerCapabilities = {
			textDocumentSync: TextDocumentSyncKind.Incremental,
			completionProvider: clientSnippetSupport ? { resolveProvider: true, triggerCharacters: ['.', ':', '<', '"', '=', '/'] } : undefined,
			hoverProvider: true,
			documentHighlightProvider: true,
			documentRangeFormattingProvider: params.initializationOptions?.provideFormatter === true,
			documentFormattingProvider: params.initializationOptions?.provideFormatter === true,
			documentLinkProvider: { resolveProvider: false },
			documentSymbolProvider: true,
			definitionProvider: true,
			signatureHelpProvider: { triggerCharacters: ['('] },
			referencesProvider: true,
			colorProvider: {},
			foldingRangeProvider: true,
			selectionRangeProvider: true,
			renameProvider: true,
			linkedEditingRangeProvider: true
		};
		return { capabilities };
});

connection.onDidChangeConfiguration(_change => {
	// Revalidate all open text documents
	documents.all().forEach(validateTextDocument);
});

// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidChangeContent(change => {
	validateTextDocument(change.document);
});

async function validateTextDocument(textDocument: TextDocument) {
	try {
		const version = textDocument.version;
		const diagnostics: Diagnostic[] = [];
		if (textDocument.languageId === 'html1') {
			const modes = languageModes.getAllModesInDocument(textDocument);
			const latestTextDocument = documents.get(textDocument.uri);
			if (latestTextDocument && latestTextDocument.version === version) {
				// check no new version has come in after in after the async op
				modes.forEach(mode => {
					if (mode.doValidation) {
						mode.doValidation(latestTextDocument).forEach(d => {
							diagnostics.push(d);
						});
					}
				});
				connection.sendDiagnostics({ uri: latestTextDocument.uri, diagnostics });
			}
		}
	} catch (e) {
		connection.console.error(`Error while validating ${textDocument.uri}`);
		connection.console.error(String(e));
	}
}

connection.onCompletion(async (textDocumentPosition, token) => {
	const document = documents.get(textDocumentPosition.textDocument.uri);
	if (!document) {
		return null;
	}

	const mode = languageModes.getModeAtPosition(document, textDocumentPosition.position);
	if (!mode || !mode.doComplete) {
		return CompletionList.create();
	}
	const doComplete = mode.doComplete!;

	return doComplete(document, textDocumentPosition.position);
});

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();
