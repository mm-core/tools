import { ExtensionContext } from 'vscode';
import insert_atom from './mm/snippets/insert-atom';
import insert_tpl from './mm/snippets/insert-tpl';
import insert_widget from './mm/snippets/insert-widget';
import list_services from './nodejs/list-services';
import addatom from './mm/add-atom';
import addlocalatom from './mm/add-local-atom';
import addwidget from './mm/add-widget';
import addlocalwidget from './mm/add-local-widget';
import addschedule from './mm/add-schedule';
import MM from './mm';

export function activate({ subscriptions }: ExtensionContext) {
	const mm = new MM();
	subscriptions.push(
		mm.addaction(),
		mm.addcomponent(),
		mm.addpage(),
		mm.addservice(),
		mm.addpresentation(),
		mm.addwebrouter(),
		mm.addwebfilter(),
		mm.completion(),
		mm.shellbuild(),
		mm.shelldebug(),
		mm.shellcreate(),
		mm.showsitemap(),
		mm.refreshsitemap(),
		insert_atom(),
		insert_tpl(),
		insert_widget(),
		list_services(),
		addatom(),
		addlocalatom(),
		addwidget(),
		addlocalwidget(),
		addschedule()
	);
}
