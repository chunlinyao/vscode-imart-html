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
const versions: { [name: string]: number } = {};
let TYPESCRIPT_LIB_SOURCE: string;
const serverFolder = URI.file(basename(__dirname) === 'dist' ? dirname(__dirname) : dirname(dirname(__dirname))).toString();
console.log(`server load from ${__dirname}`);

if (__dirname.includes('.vscode')) {
	TYPESCRIPT_LIB_SOURCE = joinPath(serverFolder, '../node_modules/typescript/lib');
} else {
	TYPESCRIPT_LIB_SOURCE = joinPath(serverFolder, '../node_modules/typescript/lib');
}
console.log(`typescript lib from ${TYPESCRIPT_LIB_SOURCE}`);

const importedScripts = new Map<string, [string[], string[]]>();
export function getImportedScripts(document: HTMLDocument, workspace: Workspace): string[] {
	let scripts: [string[], string[]];
	const workSpaceFolder = workspace.folders[0];
	if (importedScripts.has(document.uri)) {
		scripts = importedScripts.get(document.uri)!;
	} else {
		scripts = [[], []];
		scripts[0].push(document.uri);
		scripts[1].push(document.uri);
		importedScripts.set(document.uri, scripts);
		if (workSpaceFolder) {
			const imartclienttype = joinPath(workSpaceFolder!.uri, 'node_modules', '@types', 'imartclient.d.ts');
			scripts[0].push(imartclienttype);
			scripts[1].push(imartclienttype);
		}
	}

	if (!workSpaceFolder) return scripts[1];
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
		scripts[0].push(scriptFile);
	});
	removedScript.forEach((scriptFile) => {
		const idx = scripts[0].indexOf(scriptFile);
		scripts[0].splice(idx, 1);
		scripts[1].splice(idx, 1);
	});
	return scripts[1];
}

export function scriptFileChanged(uri: string) {
	console.log(`Script file changed ${uri}, remove from contents`);
	delete contents[uri];
	versions[uri] = (versions[uri] || 1) + 1;
}

export function loadLibrary(name: string) {
	if (name.indexOf('://') < 0) {
		name = joinPath(TYPESCRIPT_LIB_SOURCE, name);
	} 
	let content = contents[name];
	if (typeof content !== 'string') {
		const libPath = URI.parse(name).fsPath;
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
export function getDocumentVersion(name: string) {
	let version = versions[name];
	if (typeof version !== 'number') {
		versions[name] = version = 1;
	}
	return version;
}