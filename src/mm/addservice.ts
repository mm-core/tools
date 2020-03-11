import { dirname } from 'path';
import { commands, Uri, window, workspace } from 'vscode';
import { writeFileSync } from '../util/fs';
import generate from '../util/generate';

export default function add() {
	return commands.registerTextEditorCommand('mm.service.add', async (editor) => {
		const path = editor.document.fileName;
		const folder = dirname(path);
		// 如果当前目录不在某个页面中，则不允许操作
		const p_path = await generate(folder, 's', '\\.ts', 3);
		await create_s(p_path, p_path.replace(/.*src[/|\\]/, ''));
		await workspace.saveAll();
		window.showTextDocument(Uri.file(`${p_path}.ts`));
	});
}

function create_s(path: string, dir: string) {
	const tpl = `import an1 from '@mmstudio/an000001';
import an4 from '@mmstudio/an000004';

interface Message {
	// cookie: {
	// 	uk: string;
	// 	[key: string]: string
	// };
	// urls: {
	// 	base: string;
	// 	origin: string;
	// 	url: string;
	// };
	// query: {};
	// params: {};
	// headers: {};
	// captcha: string;
}

export default async function atom(msg: Message, actionid: string): Promise<an4> {
	an1(\`Service begin path:${dir},actionid:$\{actionid}\`);

	an1(\`Service end path:${dir},actionid:$\{actionid}\`);
	return {
		data: '"mm"'
	} as an4;
}
`;
	return writeFileSync(`${path}.ts`, tpl);
}
