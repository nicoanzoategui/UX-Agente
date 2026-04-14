figma.showUI(__html__, { width: 440, height: 680 });

async function loadDefaultFont() {
  const candidates = [
    { family: 'Inter', style: 'Regular' },
    { family: 'Roboto', style: 'Regular' },
    { family: 'Helvetica', style: 'Regular' },
  ];
  for (const f of candidates) {
    try {
      await figma.loadFontAsync(f);
      return f;
    } catch {
      /* siguiente */
    }
  }
  throw new Error('No se pudo cargar una fuente para texto.');
}

function solidPaint(fill) {
  if (!fill || typeof fill !== 'object') return [{ type: 'SOLID', color: { r: 0.92, g: 0.92, b: 0.92 } }];
  const norm = (v) => {
    if (typeof v !== 'number' || !Number.isFinite(v)) return 0.9;
    if (v > 1) return Math.min(1, Math.max(0, v / 255));
    return Math.min(1, Math.max(0, v));
  };
  return [{ type: 'SOLID', color: { r: norm(fill.r), g: norm(fill.g), b: norm(fill.b) } }];
}

async function applyRenderNode(parent, node) {
  if (!node || typeof node !== 'object') return;
  const t = node.type;
  if (t === 'TEXT') {
    const font = await loadDefaultFont();
    await figma.loadFontAsync(font);
    const text = figma.createText();
    text.fontName = font;
    text.characters = String(node.text || ' ').slice(0, 4000);
    if (typeof node.fontSize === 'number' && node.fontSize > 0) {
      text.fontSize = node.fontSize;
    }
    text.x = typeof node.x === 'number' ? node.x : 0;
    text.y = typeof node.y === 'number' ? node.y : 0;
    if (node.name) text.name = String(node.name).slice(0, 120);
    parent.appendChild(text);
    return;
  }
  if (t === 'RECTANGLE') {
    const r = figma.createRectangle();
    r.x = typeof node.x === 'number' ? node.x : 0;
    r.y = typeof node.y === 'number' ? node.y : 0;
    r.resize(Math.max(1, node.width || 1), Math.max(1, node.height || 1));
    r.fills = solidPaint(node.fills);
    if (typeof node.cornerRadius === 'number') r.cornerRadius = node.cornerRadius;
    if (node.name) r.name = String(node.name).slice(0, 120);
    parent.appendChild(r);
    return;
  }
  if (t === 'FRAME') {
    const f = figma.createFrame();
    f.x = typeof node.x === 'number' ? node.x : 0;
    f.y = typeof node.y === 'number' ? node.y : 0;
    f.resize(Math.max(1, node.width || 100), Math.max(1, node.height || 100));
    if (node.name) f.name = String(node.name).slice(0, 120);
    if (node.layoutMode === 'VERTICAL') {
      f.layoutMode = 'VERTICAL';
      if (typeof node.itemSpacing === 'number') f.itemSpacing = node.itemSpacing;
      f.paddingLeft = typeof node.paddingLeft === 'number' ? node.paddingLeft : 0;
      f.paddingRight = typeof node.paddingRight === 'number' ? node.paddingRight : 0;
      f.paddingTop = typeof node.paddingTop === 'number' ? node.paddingTop : 0;
      f.paddingBottom = typeof node.paddingBottom === 'number' ? node.paddingBottom : 0;
    } else if (node.layoutMode === 'HORIZONTAL') {
      f.layoutMode = 'HORIZONTAL';
      if (typeof node.itemSpacing === 'number') f.itemSpacing = node.itemSpacing;
    }
    parent.appendChild(f);
    if (Array.isArray(node.children)) {
      for (const ch of node.children) {
        await applyRenderNode(f, ch);
      }
    }
    return;
  }
  if (t === 'INSTANCE') {
    try {
      const comp = await figma.importComponentByKeyAsync(String(node.componentKey));
      const inst = comp.createInstance();
      inst.x = typeof node.x === 'number' ? node.x : 0;
      inst.y = typeof node.y === 'number' ? node.y : 0;
      if (typeof node.width === 'number' && typeof node.height === 'number') {
        inst.resize(Math.max(1, node.width), Math.max(1, node.height));
      } else if (typeof node.width === 'number') {
        inst.resize(Math.max(1, node.width), Math.max(1, inst.height));
      }
      if (node.name) inst.name = String(node.name).slice(0, 120);
      parent.appendChild(inst);
    } catch {
      const r = figma.createRectangle();
      r.name = 'INSTANCE ? ' + String(node.componentKey || '').slice(0, 36);
      r.x = typeof node.x === 'number' ? node.x : 0;
      r.y = typeof node.y === 'number' ? node.y : 0;
      r.resize(96, 32);
      r.fills = [{ type: 'SOLID', color: { r: 1, g: 0.85, b: 0.85 } }];
      parent.appendChild(r);
    }
  }
}

async function fetchRenderNodes(apiBase, renderSecret, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (renderSecret) headers['X-UX-Agent-Figma-Render-Secret'] = renderSecret;
  const res = await fetch(`${apiBase}/api/figma-render-screen`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText || String(res.status));
  return data;
}

figma.ui.onmessage = async (msg) => {
  if (msg.type === 'ui-ready') {
    try {
      const apiBase = await figma.clientStorage.getAsync('ux_agente_api_base');
      const renderSecret = await figma.clientStorage.getAsync('ux_agente_render_secret');
      figma.ui.postMessage({
        type: 'init',
        apiBase: typeof apiBase === 'string' ? apiBase : '',
        renderSecret: typeof renderSecret === 'string' ? renderSecret : '',
      });
    } catch {
      figma.ui.postMessage({ type: 'init', apiBase: '', renderSecret: '' });
    }
    return;
  }
  if (msg.type === 'save-api-base') {
    try {
      await figma.clientStorage.setAsync('ux_agente_api_base', String(msg.apiBase || '').trim());
      await figma.clientStorage.setAsync('ux_agente_render_secret', String(msg.renderSecret || '').trim());
    } catch {
      /* ignore */
    }
    return;
  }
  if (msg.type === 'cancel') {
    figma.closePlugin();
    return;
  }
  if (msg.type !== 'build') return;

  const apiBase = String(msg.apiBase || '').trim().replace(/\/$/, '');
  const jobId = String(msg.jobId || '').trim();
  const secret = String(msg.secret || '').trim();
  const renderSecret = String(msg.renderSecret || '').trim();
  if (!apiBase || !jobId || !secret) {
    figma.ui.postMessage({ type: 'error', text: 'Completá URL del API, jobId y secret.' });
    return;
  }

  try {
    const url = `${apiBase}/api/figma-build-job/${encodeURIComponent(jobId)}?secret=${encodeURIComponent(secret)}`;
    const res = await fetch(url);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      figma.ui.postMessage({ type: 'error', text: data.error || res.statusText || String(res.status) });
      return;
    }
    const payload = data.payload;
    if (!payload || (payload.version !== 1 && payload.version !== 2)) {
      figma.ui.postMessage({ type: 'error', text: 'Payload inválido o vacío.' });
      return;
    }

    const fk = typeof figma.fileKey === 'string' ? figma.fileKey : '';
    if (fk && payload.destinationFileKey && fk !== payload.destinationFileKey) {
      figma.ui.postMessage({
        type: 'error',
        text: `Abrí el archivo Figma correcto (esperado file key: ${payload.destinationFileKey}).`,
      });
      return;
    }

    /** @type {PageNode | FrameNode | SectionNode | GroupNode} */
    let parent = figma.currentPage;
    if (payload.destinationNodeId) {
      const node = await figma.getNodeByIdAsync(payload.destinationNodeId);
      if (!node) {
        figma.ui.postMessage({
          type: 'error',
          text: `No encontré el nodo ${payload.destinationNodeId}. Abrí el link de destino en este archivo.`,
        });
        return;
      }
      const tp = node.type;
      if (tp === 'PAGE') {
        await figma.setCurrentPageAsync(node);
        parent = figma.currentPage;
      } else if (tp === 'SECTION' || tp === 'FRAME' || tp === 'GROUP') {
        parent = node;
      } else {
        figma.ui.postMessage({
          type: 'error',
          text: `El nodo destino debe ser PAGE, SECTION, FRAME o GROUP (tipo actual: ${tp}).`,
        });
        return;
      }
    }

    const { frameWidth: w, frameHeight: h, gap, startX, startY } = payload.layout;
    const dsKey = payload.designSystemFileKey || '';
    let x = startX;
    const created = [];
    const warnings = [];

    for (const s of payload.screens) {
      const frame = figma.createFrame();
      frame.name = `${s.screenIndex}. ${s.name}`.slice(0, 120);
      frame.resize(w, h);
      frame.x = x;
      frame.y = startY;
      frame.clipsContent = true;

      const hifi = typeof s.hifiHtml === 'string' ? s.hifiHtml.trim() : '';
      if (hifi && dsKey && renderSecret) {
        try {
          const rd = await fetchRenderNodes(apiBase, renderSecret, {
            hifiHtml: hifi,
            designSystemFileKey: dsKey,
            destinationFileKey: payload.destinationFileKey,
          });
          if (Array.isArray(rd.warnings) && rd.warnings.length) {
            warnings.push(...rd.warnings.map(String));
          }
          const nodes = Array.isArray(rd.nodes) ? rd.nodes : [];
          for (const n of nodes) {
            await applyRenderNode(frame, n);
          }
        } catch (e) {
          const err = e && typeof e === 'object' && 'message' in e ? String(e.message) : String(e);
          warnings.push(`Pantalla ${s.screenIndex}: ${err}`);
        }
      }

      parent.appendChild(frame);
      created.push({ id: frame.id, name: frame.name });
      x += w + gap;
    }
    figma.ui.postMessage({
      type: 'done',
      count: created.length,
      frames: created,
      warnings: warnings.length ? warnings.join('\n') : '',
    });
  } catch (e) {
    const err = e && typeof e === 'object' && 'message' in e ? String(e.message) : String(e);
    figma.ui.postMessage({ type: 'error', text: err });
  }
};
