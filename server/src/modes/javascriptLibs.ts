/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { join, basename, dirname } from 'path';
import { readFileSync, readFile, existsSync } from 'fs';
import { HTMLDocument, HTMLDocumentRegions } from './embeddedSupport';
import { TextDocument, Workspace } from './languageModes';
import { joinPath, isAbsolutePath, extname, dirname as uriDirName } from '../requests';
import { URI } from 'vscode-uri';
const contents: { [name: string]: string } = {};
let TYPESCRIPT_LIB_SOURCE: string;
const serverFolder = URI.file(basename(__dirname) === 'dist' ? dirname(__dirname) : dirname(dirname(__dirname))).toString();
if (__dirname.includes('.vscode')) {
	TYPESCRIPT_LIB_SOURCE = joinPath(serverFolder, '../node_modules/typescript/lib');
} else {
	TYPESCRIPT_LIB_SOURCE = joinPath(serverFolder, '../../node_modules/typescript/lib');
}
const importedScripts = new Map<string, [string[], string[]]>();
const scriptDocuments = new Map<string, true>();
export function getImportedScripts(document: HTMLDocument, workspace: Workspace): string[] {
	let scripts: [string[], string[]];
	if (importedScripts.has(document.uri)) {
		scripts = importedScripts.get(document.uri)!;
	} else {
		scripts = [[], []];
		scripts[0].push(document.uri);
		scripts[1].push(document.uri);
		importedScripts.set(document.uri, scripts);
	}
	const workSpaceFolder = workspace.folders[0];
	if (!workSpaceFolder) return scripts[1];
	const imartclienttype = joinPath(workSpaceFolder!.uri, 'node_modules', '@types', 'imartclient.d.ts');
	scripts[0].push(imartclienttype);
	scripts[1].push(imartclienttype);
	const addedScript = document.importedScripts.filter(e => !scripts[0].includes(e));
	const removedScript = scripts[0].filter((e, idx) => idx > 1 && (!document.importedScripts.includes(e)));
	addedScript.forEach(scriptFile => {
		const extFileName = extname(scriptFile);
		if (extFileName !== '.js' && extFileName !== '.ts') { return; }
		let absScriptFile;
		if (isAbsolutePath(scriptFile)) {
			absScriptFile = joinPath(workSpaceFolder!.uri, scriptFile);
		} else {
			absScriptFile = joinPath(workSpaceFolder!.uri, 'src/main/webapp', scriptFile);
		}
		const absDTSFile = absScriptFile.substring(0, absScriptFile.lastIndexOf('.')) + '.d.ts';
		if (existsSync(URI.parse(absDTSFile).fsPath)) {
			scripts[1].push(absDTSFile);
		} else if (existsSync(URI.parse(absScriptFile).fsPath)) {
			scripts[1].push(absScriptFile);
		} else {
			return;
		}
		scriptDocuments.set(scripts[1][scripts.length-1], true);
		scripts[0].push(scriptFile);
	});
	removedScript.forEach((scriptFile) => {
		const idx = scripts[0].indexOf(scriptFile);
		scripts[0].splice(idx, 1);
		scriptDocuments.delete(scripts[1][idx]);
		scripts[1].splice(idx, 1);
	});
	return scripts[1];
}

export function scriptFileChanged(uri: string) {
	console.log(`Script file changed ${uri}, remove from contents`);
	delete contents[uri];
}

export function loadLibrary(name: string) {
	let content = contents[name];
	URI.isUri;
	if (typeof content !== 'string') {
		let libPath;
		const uri = URI.parse(name);
		if (isAbsolutePath(uri.fsPath)) {
			libPath = uri.fsPath; //from import
		} else {
			libPath = join(TYPESCRIPT_LIB_SOURCE, name); // from source
		}
		try {
			content = readFileSync(libPath).toString();
		} catch (e: any) {
			console.log(`Unable to load library ${name} at ${libPath}: ${e.message}`);
			content = '';
		}
		contents[name] = content;
	}
	return content;
}
