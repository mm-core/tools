import { dirname, join, relative } from 'path';
import { FileType, Position, QuickPickItem, SnippetString, TextEditor, Uri, window, workspace, WorkspaceEdit } from 'vscode';
import Actor from '../actor';
import { IAtom, IAtomCatagory } from '../interfaces';

export default class AddTplWidgetMobile extends Actor {
	private editor: TextEditor;
	public set_editor(editor: TextEditor) {
		this.editor = editor;
		return this;
	}
	public async do(): Promise<void> {
		const editor = this.editor;
		if (!this.remotewidgets) {
			this.remotewidgets = await this.get<IAtomCatagory[]>('https://mmstudio.gitee.io/widgets-mobile/index.json');
		}
		const atoms = this.remotewidgets;
		const all = new Map<string, IAtom>();
		const catagories = new Map<string, IAtom[]>();
		atoms.forEach((it) => {
			catagories.set(it.catagory, it.atoms);
			it.atoms.forEach((atom) => {
				all.set(atom.no, atom);
			});
		});
		await this.insert_widget_snippet(editor, all, catagories);
	}
	public act(): Promise<void> {
		throw new Error('Method not implemented.');
	}
	private async insert_widget_snippet(textEditor: TextEditor, all_remote: Map<string, IAtom>, catagories_remote: Map<string, IAtom[]>) {
		const root_path = this.root(textEditor);
		const local_atoms = await this.load_local_widgets(root_path);
		const catagories = new Map<string, IAtom[]>();
		catagories.set('本地', local_atoms);
		catagories_remote.forEach((v, k) => {
			catagories.set(k, v);
		});
		const all = new Map<string, IAtom>();
		local_atoms.forEach((atom) => {
			all.set(atom.no, atom);
		});
		all_remote.forEach((v, k) => {
			all.set(k, v);
		});
		const selects = Array.from(catagories.keys()).map((catagory) => {
			const item: QuickPickItem = {
				label: catagory
			};
			return item;
		}).concat(Array.from(all.values()).map((atom) => {
			const item: QuickPickItem = {
				detail: atom.name,
				label: atom.no
			};
			return item;
		}));

		const picked = await this.pick(selects, '选择一个分类或直接输入控件编号并回车');
		if (!picked) {
			return;
		}
		const pick = all.get(picked.label);

		if (pick) {
			await this.add_snippet(pick, textEditor);
			return;
		}
		const atoms = catagories.get(picked.label)!;
		const selected_atom = await this.pick(atoms.map((it) => {
			const item: QuickPickItem = {
				detail: it.name,
				label: it.no
			};
			return item;
		}), '选择一个控件编号并回车');
		if (!selected_atom) {
			return;
		}
		await this.add_snippet(all.get(selected_atom.label)!, textEditor);
	}

	private async load_local_widgets(root: string) {
		try {
			const atom_dir = join(root, 'src', 'widgets');
			const atoms_dirs = await workspace.fs.readDirectory(Uri.file(atom_dir));
			return atoms_dirs.filter(([ad, type]) => {
				if (type !== FileType.Directory) {
					return false;
				}
				return ad.startsWith('pw');
			}).map(([p]) => {
				return {
					name: `项目级控件:${p}`,
					no: p,
					local: true
				} as IAtom;
			});
		} catch {
			return [];
		}
	}

	private async add_snippet(atom: IAtom, editor: TextEditor) {
		if (atom.local) {
			await this.add_local(atom, editor);
			return;
		}
		await this.shellinstall(editor, atom.no, atom.version, true);
		const dir = join(this.root(editor), 'node_modules', atom.no);
		const snippet_use = join(dir, 'use.snippet');
		const name = atom.no.replace(/(.+\/)?/, '').toUpperCase();
		const imp = `import ${name} from '${atom.no}';`;
		if (!await this.exists(snippet_use)) {
			window.showErrorMessage('无法自动添加脚本，请联系供应商');
			return;
		}
		const use = await this.readfile(snippet_use);
		await this.update_import(imp, editor);
		await editor.insertSnippet(new SnippetString(use), editor.selection.active, {
			undoStopAfter: true,
			undoStopBefore: true
		});
	}

	private async add_local(atom: IAtom, editor: TextEditor) {
		const doc = editor.document;
		const dir = join(this.root(editor), 'src', 'widgets', atom.no);
		const cur = dirname(doc.uri.fsPath);
		const imp_path = relative(cur, dir);
		const name = atom.no.toUpperCase();
		const imp = `import ${name} from '${imp_path}/index';`;
		const snippet_use = Uri.file(join(dir, 'use.snippet'));
		const use = Buffer.from(await workspace.fs.readFile(snippet_use)).toString('utf8');

		await this.update_import(imp, editor);
		await editor.insertSnippet(new SnippetString(use), editor.selection.active, {
			undoStopAfter: true,
			undoStopBefore: true
		});
	}

	private async update_import(imp: string, editor: TextEditor) {
		// import widget in tpl.tsx or index.tsx(if current file is a widgets, too)
		const doc = editor.document;
		const max = doc.lineCount;
		let hasimport = false;
		let pos = -1;
		for (let i = 0; i < max; i++) {
			const line = doc.lineAt(i);
			const text = line.text;
			if (/^import\s+.+/.test(text)) {
				if (text === imp) {
					hasimport = true;
					break;
				}
				pos = i;
			}
		}
		if (!hasimport) {
			const we = new WorkspaceEdit();
			const uri = doc.uri;
			const imppos = new Position(pos + 1, 0);
			we.insert(uri, imppos, `${imp}\n`);
			await workspace.applyEdit(we);
		}
	}
	private remotewidgets = [] as IAtomCatagory[];
}
