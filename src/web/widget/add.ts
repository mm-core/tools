import { basename, join } from 'path';
import { promises } from 'fs';
import { commands, Uri, window, workspace } from 'vscode';
import workpath from '../../util/workpath';
import generate from '../../util/generate';
import exec from '../../util/exec';
import { Package } from '../../interfaces';
import tplwidgetusage from './tpl-web-widget-useage';
import tplwidget from './tpl-web-widget';

const { readFile, writeFile } = promises;

export default async function add_common_widget() {
	const def = await workpath();
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
	const cwd = await generate(folder.fsPath, 'ww', '', 6);
	const no = basename(cwd);
	const remote = await window.showInputBox({
		value: `git@github.com:mm-widgets/${no}.git`,
		placeHolder: `请提供一个可用的空git仓库地址,如: git@github.com:${user}/${no}.git`
	});
	if (!remote) {
		return;
	}
	const uri = Uri.file(cwd);
	try {
		// 如果已经存在，则覆盖
		await workspace.fs.stat(uri);
		await workspace.fs.delete(uri);
	} catch (e) {
		// 目录不存在
		console.error(e);
	}
	// 创建目录
	await workspace.fs.createDirectory(uri);
	// 进入目录并且拉取代码
	await exec('git init', cwd);
	// 从码云拉取代码模板
	await exec('git pull git@github.com:mm-tpl/widgets-web.git', cwd);

	// package.json
	const pkg = await update_pkg(cwd, no, user, remote);
	// readme.md
	await update_readme(cwd, pkg.description);

	// amd.json
	await update_amd(cwd, no);

	// use.snippet
	await update_usage(cwd, no);
	// src/index.ts
	await update_ts(cwd, no);
	// tests/amd.html
	await update_html(cwd, no, 'amd.html');
	// tests/ie.html
	await update_html(cwd, no, 'ie.html');

	await exec(`git commit -am "init widget ${no}"`, cwd);
	// 推送代码到远程仓库
	if (remote) {
		await exec(`git remote add origin ${remote}`, cwd);
		await exec('git push -u origin master', cwd);
	}
	window.showInformationMessage('控件初始化已完成，即将安装必要依赖，请耐心等待，安装成功后即将自动重启vscode');
	await exec('yarn', cwd);
	await commands.executeCommand('vscode.openFolder', uri);
}

async function update_html(folder: string, no: string, pagename: string) {
	no = no.replace(/[a-z]*/, '');
	const tag = `mm-${no}`;
	const path = join(folder, 'tests', pagename);
	const old = await readFile(path, 'utf-8');
	const content = old.replace(/(<title>).*(<\/title>)/, `$1${tag}$2`).replace(/<mm-\d+(.*)<\/mm-\d+>/g, `<${tag}$1</${tag}>`);;
	await writeFile(path, content);
}

async function update_amd(folder: string, no: string) {
	const path = join(folder, 'amd.json');

	const content = `[
	{
		"name": "@mmstudio/${no}",
		"location": "@mmstudio/${no}/dist",
		"main": "main"
	}
]
`;
	await writeFile(path, content);
}

async function update_ts(folder: string, no: string) {
	const content = tplwidget(no, false);
	const path = join(folder, 'src', 'index.ts');
	await writeFile(path, content);
}

async function update_usage(folder: string, no: string) {
	const path = join(folder, 'use.snippet');
	const content = tplwidgetusage(no, false);
	await writeFile(path, content);
}

async function update_readme(folder: string, description: string) {
	const path = join(folder, 'readme.md');
	const d = await window.showInputBox({
		value: description,
		prompt: '控件的描述，可以详细一些，后期请修改readme.md文件',
		validateInput(v) {
			if (!v) {
				return '不能为空';
			}
			return null;
		}
	});
	if (d) {
		await writeFile(path, `# ${d}\n`);
	}
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
	const u = await window.showInputBox({
		value: user,
		prompt: '用户名',
		validateInput(v) {
			if (!v) {
				return '不能为空';
			}
			return null;
		}
	});
	if (u) {
		author.name = u;
	}
	const e = await window.showInputBox({
		value: email,
		prompt: '用户邮箱',
		validateInput(v) {
			if (!v) {
				return '不能为空';
			}
			return null;
		}
	});
	if (e) {
		author.email = e;
	}
	const d = await window.showInputBox({
		value: pkg.description,
		prompt: '控件简要描述,请尽量控制在8个字以内',
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
