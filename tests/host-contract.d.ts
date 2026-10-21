/** Offline host contract ONLY. Normal `npm run typecheck` uses the official obsidian package.
 * This subset catches internal type mistakes but does not prove host/API compatibility. */
declare module 'obsidian' {
 export class TAbstractFile {path:string;name:string}
 export class TFile extends TAbstractFile {extension:string;basename:string;stat:{size:number;mtime:number;ctime:number}}
 export class TFolder extends TAbstractFile {}
 export interface EventRef {}
 export class FileSystemAdapter {getFullPath(path:string):string}
 export class Vault {
  adapter:unknown;
  getAbstractFileByPath(path:string):TAbstractFile|null;getMarkdownFiles():TFile[];getFiles():TFile[];
  createFolder(path:string):Promise<TFolder>;read(file:TFile):Promise<string>;create(path:string,text:string):Promise<TFile>;
  createBinary(path:string,bytes:ArrayBuffer):Promise<TFile>;readBinary(file:TFile):Promise<ArrayBuffer>;
  process(file:TFile,fn:(current:string)=>string):Promise<string>;delete(file:TFile):Promise<void>;getResourcePath(file:TFile):string;
  on(event:string,callback:(...args:unknown[])=>void):EventRef;
 }
 export class WorkspaceLeaf {view:ItemView;openFile(file:TFile):Promise<void>;setViewState(state:{type:string;active:boolean}):Promise<void>}
 export class App {vault:Vault;fileManager:{processFrontMatter(file:TFile,fn:(fm:Record<string,unknown>)=>void):Promise<void>;generateMarkdownLink(file:TFile,from:string,subpath?:string,alias?:string):string;renameFile(file:TFile,newPath:string):Promise<void>};metadataCache:{getFirstLinkpathDest(link:string,from:string):TFile|null};workspace:{getLeavesOfType(type:string):WorkspaceLeaf[];getLeaf(newLeaf?:boolean|'tab'):WorkspaceLeaf;revealLeaf(leaf:WorkspaceLeaf):Promise<void>}}
 export function parseYaml(text:string):unknown;
 export class Notice {constructor(message:string,duration?:number)}
 export class ItemView {app:App;contentEl:HTMLElement;constructor(leaf:WorkspaceLeaf);onOpen():Promise<void>;onClose():Promise<void>}
 export class Modal {app:App;contentEl:HTMLElement;constructor(app:App);open():void;close():void;onOpen():void;onClose():void}
 export class FuzzySuggestModal<T> extends Modal {constructor(app:App);getItems():T[];getItemText(item:T):string;onChooseItem(item:T,event:MouseEvent|KeyboardEvent):void}
 export class Plugin {app:App;loadData():Promise<unknown>;saveData(data:unknown):Promise<void>;registerView(type:string,fn:(leaf:WorkspaceLeaf)=>ItemView):void;addRibbonIcon(icon:string,title:string,fn:()=>void):void;addCommand(command:{id:string;name:string;callback:()=>void}):void;addSettingTab(tab:PluginSettingTab):void;registerEvent(event:EventRef):void;register(fn:()=>void):void}
 export class PluginSettingTab {containerEl:HTMLElement;constructor(app:App,plugin:Plugin)}
 export class Setting {constructor(el:HTMLElement);setName(text:string):this;setDesc(text:string):this;addDropdown(fn:(drop:{addOption(k:string,v:string):any;setValue(v:string):any;onChange(fn:(value:string)=>void|Promise<void>):any})=>void):this;addToggle(fn:(toggle:{setValue(value:boolean):any;onChange(fn:(value:boolean)=>void|Promise<void>):any})=>void):this;addButton(fn:(button:{setButtonText(value:string):any;onClick(fn:()=>void):any})=>void):this}
}
