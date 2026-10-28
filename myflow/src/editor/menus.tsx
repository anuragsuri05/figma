import { commandMap, runCommand } from '../commands';
import type { MenuItem } from './ui';
import { S, selectedNodes, currentDoc, goToPage, addPage, deletePage, duplicatePage } from '../store/editor';

type Entry = string | '-' | { label: string; items: Entry[] } | { header: string };

function build(entries: Entry[]): MenuItem[] {
  return entries.map((e): MenuItem => {
    if (e === '-') return { separator: true };
    if (typeof e === 'string') {
      const c = commandMap.get(e);
      if (!c) return { label: e, disabled: true };
      return {
        label: c.label,
        keys: c.keys?.[0],
        disabled: c.enabled ? !c.enabled() : false,
        checked: c.checked?.(),
        onClick: () => runCommand(e),
        testId: 'cmd-' + e,
      };
    }
    if ('header' in e) return { header: e.header };
    return { label: e.label, submenu: build(e.items) };
  });
}

export function mainMenuItems(): MenuItem[] {
  const doc = S().doc;
  return build([
    'file.back',
    'help.quick',
    '-',
    { label: 'File', items: ['file.new', '-', 'file.placeImage', '-', 'file.saveLocal', 'file.saveVersion', 'file.versionHistory', '-', 'file.export', 'file.exportPdf', '-', 'file.share', 'file.duplicate', 'file.rename', 'file.delete', '-', 'file.libraries'] },
    { label: 'Edit', items: ['edit.undo', 'edit.redo', '-', 'edit.copy', 'edit.cut', 'edit.paste', 'edit.pasteOver', 'edit.pasteReplace', 'edit.duplicate', 'edit.delete', '-',
      { label: 'Copy as', items: ['edit.copyAsPng', 'edit.copyAsSvg', 'edit.copyAsCss', 'edit.copyLink'] },
      'edit.copyProps', 'edit.pasteProps', '-', 'edit.selectAll', 'edit.selectInverse', 'edit.selectNone', '-',
      { label: 'Select all with same…', items: ['edit.selectSameFill', 'edit.selectSameStroke', 'edit.selectSameEffect', 'edit.selectSameFont', 'edit.selectSameInstance', 'edit.selectMatching'] },
      '-', 'edit.find', 'edit.rename', '-', 'misc.variables', 'misc.styles'] },
    { label: 'View', items: ['view.dotGrid', 'view.pixelGrid', 'view.snapPixel', 'view.layoutGrids', 'view.rulers', '-', 'view.outlines', 'view.pixelPreview', 'view.maskOutlines', 'view.frameOutlines', '-', 'view.cursors', 'view.comments', 'misc.commentsPanel', '-', 'view.ui', '-',
      { label: 'Panels', items: ['view.leftPanel', 'view.assets', 'view.designTab', 'view.prototypeTab', 'view.devMode'] },
      '-', 'view.zoomIn', 'view.zoomOut', 'view.zoom100', 'view.zoom50', 'view.zoom200', 'view.zoomFit', 'view.zoomSelection', '-', 'view.prevFrame', 'view.nextFrame', 'view.prevPage', 'view.nextPage', '-', 'view.theme'] },
    { label: 'Object', items: ['obj.group', 'obj.ungroup', 'obj.frame', '-', 'obj.autoLayout', 'obj.removeAutoLayout', '-', 'obj.createComponent', 'obj.createMultiple', 'obj.combineVariants', 'obj.addVariant', 'obj.resetInstance', 'obj.detach', 'obj.goToMain', 'obj.pushToMain', '-', 'obj.mask', 'obj.setThumbnail', '-',
      'obj.bringFront', 'obj.bringForward', 'obj.sendBackward', 'obj.sendBack', '-', 'obj.flipH', 'obj.flipV', 'obj.rotate180', 'obj.rotateCW', 'obj.rotateCCW', '-',
      { label: 'Boolean groups', items: ['obj.union', 'obj.subtract', 'obj.intersect', 'obj.exclude'] },
      'obj.flatten', 'obj.outlineStroke', '-', 'obj.lock', 'obj.hide', 'obj.unlockAll', 'obj.showAll', 'obj.collapseLayers', '-', 'obj.removeFill', 'obj.removeStroke', 'obj.swapFillStroke'] },
    { label: 'Text', items: ['text.bold', 'text.italic', 'text.underline', 'text.strike', '-', 'text.bullets', 'text.numbers', '-', 'text.alignLeft', 'text.alignCenter', 'text.alignRight', 'text.alignJustify', '-',
      { label: 'Adjust', items: ['text.sizeUp', 'text.sizeDown', 'text.spacingUp', 'text.spacingDown', 'text.lhUp', 'text.lhDown', 'text.weightUp', 'text.weightDown'] },
      { label: 'Case', items: ['text.originalCase', 'text.upper', 'text.lower', 'text.title'] }] },
    { label: 'Arrange', items: ['arr.alignLeft', 'arr.alignHCenter', 'arr.alignRight', '-', 'arr.alignTop', 'arr.alignVCenter', 'arr.alignBottom', '-', 'arr.distH', 'arr.distV', 'arr.tidy', '-', 'arr.roundPixel'] },
    { label: 'Prototype', items: ['proto.present', 'proto.addFlow', 'view.prototypeTab'] },
    { label: 'AI', items: ['ai.agent', 'ai.firstDraft', '-', 'ai.rename', 'ai.realistic', { label: 'Edit text', items: ['ai.rewrite', 'ai.shorten', 'ai.lengthen', 'ai.fix', 'ai.friendly', 'ai.formal', 'ai.translate'] }, '-', 'ai.prototype', 'ai.critique', 'ai.a11y', '-', 'ai.code', 'ai.make', 'ai.illustration', 'ai.icon', '-', 'ai.settings'] },
    { label: 'Plugins', items: ['plugin.lorem', 'plugin.image', 'plugin.contrast', 'plugin.rename', 'plugin.palette', 'plugin.cleanup', 'plugin.icons', 'plugin.chart', '-', 'plugin.manage'] },
    { label: 'Preferences', items: [] },
    '-',
    { label: 'Help and account', items: ['help.shortcuts', 'help.about'] },
  ]).map((it) => {
    if (it.label === 'Preferences') {
      const p = S().prefs;
      const toggle = (k: keyof typeof p) => () => S().setPrefs({ [k]: !p[k] } as Partial<typeof p>);
      it.submenu = [
        { label: 'Snap to geometry', checked: p.snapToGeometry, onClick: toggle('snapToGeometry') },
        { label: 'Snap to objects', checked: p.snapToObjects, onClick: toggle('snapToObjects') },
        { label: 'Snap to pixel grid', checked: p.snapToPixel, onClick: toggle('snapToPixel') },
        { separator: true },
        { label: 'Keep tool selected after use', checked: p.keepToolSelected, onClick: toggle('keepToolSelected') },
        { label: 'Highlight layers on hover', checked: p.highlightOnHover, onClick: toggle('highlightOnHover') },
        { label: 'Rename duplicated layers', checked: p.renameDuplicated, onClick: toggle('renameDuplicated') },
        { label: 'Show dimensions on objects', checked: p.showDimensions, onClick: toggle('showDimensions') },
        { label: 'Invert zoom', checked: p.invertZoom, onClick: toggle('invertZoom') },
        { label: 'Use number keys for opacity', checked: p.numberKeysOpacity, onClick: toggle('numberKeysOpacity') },
        { separator: true },
        { label: 'Theme', submenu: [
          { label: 'Light', checked: p.theme === 'light', onClick: () => S().setPrefs({ theme: 'light' }) },
          { label: 'Dark', checked: p.theme === 'dark', onClick: () => S().setPrefs({ theme: 'dark' }) },
          { label: 'Follow system', checked: p.theme === 'system', onClick: () => S().setPrefs({ theme: 'system' }) },
        ] },
        { label: 'Nudge amount…', onClick: () => S().setState({ modal: 'preferences' }) },
        { label: 'All preferences…', onClick: () => S().setState({ modal: 'preferences' }) },
      ];
    }
    return it;
  }).concat(doc ? [] : []);
}

export function selectionContextItems(): MenuItem[] {
  const sel = selectedNodes();
  const doc = currentDoc();
  const n = sel[0];
  const isInst = sel.some((x) => x.type === 'INSTANCE');
  const isComp = sel.some((x) => x.type === 'COMPONENT');
  const inSet = n?.parentId && doc.nodes[n.parentId]?.type === 'COMPONENT_SET';
  const entries: Entry[] = ['edit.copy', 'edit.paste', 'edit.pasteReplace', '-', 'edit.duplicate', 'edit.delete', '-',
    { label: 'Copy/Paste as', items: ['edit.copyAsPng', 'edit.copyAsSvg', 'edit.copyAsCss', 'edit.copyLink', '-', 'edit.copyProps', 'edit.pasteProps'] },
    '-', 'obj.bringFront', 'obj.bringForward', 'obj.sendBackward', 'obj.sendBack', '-', 'obj.group', 'obj.ungroup', 'obj.frame', '-', 'obj.flipH', 'obj.flipV', '-',
    'obj.autoLayout', 'obj.removeAutoLayout', '-', 'obj.createComponent'];
  if (sel.length > 1) entries.push('obj.createMultiple');
  if (isComp || inSet) entries.push('obj.combineVariants', 'obj.addVariant');
  if (isInst) entries.push('obj.goToMain', 'obj.resetInstance', 'obj.detach', 'obj.pushToMain');
  entries.push('-', 'obj.mask', { label: 'Boolean groups', items: ['obj.union', 'obj.subtract', 'obj.intersect', 'obj.exclude'] }, 'obj.flatten', 'obj.outlineStroke', '-', 'obj.hide', 'obj.lock', '-', 'proto.addFlow', 'obj.setThumbnail', '-',
    { label: 'AI', items: ['ai.agent', 'ai.rename', 'ai.realistic', 'ai.rewrite', 'ai.shorten', 'ai.translate', '-', 'ai.critique', 'ai.a11y', 'ai.code', 'ai.make'] },
    { label: 'Plugins', items: ['plugin.lorem', 'plugin.image', 'plugin.contrast', 'plugin.rename'] }, 'file.export');
  return build(entries);
}

export function canvasContextItems(): MenuItem[] {
  return build(['edit.paste', '-', 'view.ui', 'view.rulers', 'view.outlines', 'view.layoutGrids', '-', 'edit.selectAll', 'view.zoomFit', '-', 'misc.addPage', 'plugin.manage']);
}

export function pageContextItems(pageId: string, rename: () => void): MenuItem[] {
  const doc = currentDoc();
  return [
    { label: 'Copy link to page', onClick: () => { navigator.clipboard?.writeText(`${location.href.split('?')[0]}?page-id=${pageId}`).catch(() => {}); S().toast('Link copied'); } },
    { separator: true },
    { label: 'Rename page', onClick: rename, testId: 'page-rename' },
    { label: 'Duplicate page', onClick: () => duplicatePage(pageId), testId: 'page-duplicate' },
    { label: 'Delete page', onClick: () => deletePage(pageId), disabled: doc.pages.length <= 1, testId: 'page-delete' },
    { separator: true },
    { label: 'Add page', onClick: () => addPage() },
    { label: 'Go to page', onClick: () => goToPage(pageId) },
  ];
}
