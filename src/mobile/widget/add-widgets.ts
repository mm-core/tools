import { basename, dirname, join } from 'path';
import { promises } from 'fs';
import { commands, Uri, window, workspace } from 'vscode';
import workpath from '../../util/workpath';
import generate from '../../util/generate';
import exec from '../../util/exec';
import { Package } from '../../interfaces';
import tplwidgetusage from './tpl-widget-useage';

const { readFile, writeFile } = promises;

export default async function add_common_widget_mobile() {
	const def = dirname(await workpath());
	const container = await window.showOpenDialog({
		defaultUri: Uri.file(def),
		canSelectFiles: false,
		canSelectFolders: true,
		canSelectMany: false
	});
	if (!container || container.length !== 1) {
		return;
	}

	const user = await exec('git config user.name');

	const folder = container[0];
	let cwd = await generate(folder.fsPath, 'wm', '', 6);
	let no = basename(cwd);
	const remote = await window.showInputBox({
		value: `git@github.com:mm-widgets/${no}.git`,
		ignoreFocusOut: true,
		placeHolder: `请提供一个可用的空git仓库地址,如: git@github.com:${user}/${no}.git`
	});
	if (!remote) {
		return;
	}
	const m = /\/(\w+\d+)(\.git)?$/.exec(remote);
	if (m) {
		no = m[1];
		cwd = join(folder.fsPath, no);
	}
	const uri = Uri.file(cwd);
	try {
		// 如果已经存在，则覆盖
		await workspace.fs.stat(uri);
		await workspace.fs.delete(uri);
	} catch (e) {
		// 目录不存在
	}
	// 创建目录
	await workspace.fs.createDirectory(uri);
	// 进入目录并且拉取代码
	await exec('git init', cwd);
	// 从码云拉取代码模板
	await exec('git pull git@github.com:mm-tpl/widgets-mobile.git', cwd);

	// package.json
	const pkg = await update_pkg(cwd, no, user, remote);
	// readme.md
	await update_readme(cwd, pkg.description);

	// use.snippet
	await update_usage(cwd, no);

	await exec(`git commit -am "init widget ${no}"`, cwd);
	// 推送代码到远程仓库
	await exec(`git remote add origin ${remote}`, cwd);
	await exec('git push -u origin master', cwd);
	window.showInformationMessage('控件初始化已完成，即将安装必要依赖，请耐心等待，安装成功后即将自动重启vscode');
	await exec('yarn', cwd);
	await commands.executeCommand('vscode.openFolder', uri);
}

async function update_usage(folder: string, no: string) {
	const path = join(folder, 'use.snippet');
	const content = tplwidgetusage(no);
	await writeFile(path, content);
}

async function update_readme(folder: string, description: string) {
	const path = join(folder, 'readme.md');
	await writeFile(path, `# ${description}\n`);
}

async function update_pkg(folder: string, no: string, user: string, remote: string) {
	const path = join(folder, 'package.json');
	const email = await exec('git config user.email');
	const content = await readFile(path, 'utf-8');
	const pkg = JSON.parse(content) as Package;
	pkg.name = `@mmstudio/${no}`;
	delete pkg.scripts.up;
	const repository = remote.replace(':', '/').replace('git@', 'https://');	// git@github.com:mm-atom/no.git to https://github.com/mm-atom/no.git
	pkg.repository.url = repository;
	const author = pkg.author || {};
	author.name = user;
	author.email = email;
	const d = await window.showInputBox({
		value: pkg.description,
		prompt: '控件简要描述,请尽量控制在8个字以内',
		ignoreFocusOut: true,
		validateInput(v) {
			if (!v) {
				return '不能为空';
			}
			return null;
		}
	});
	if (d) {
		pkg.description = d;
	}
	await writeFile(path, JSON.stringify(pkg, null, '\t'));
	return pkg;
}