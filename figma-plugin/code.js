figma.showUI(__html__, { width: 440, height: 580 });

figma.ui.onmessage = async (msg) => {
  if (msg.type === 'ui-ready') {
    try {
      const apiBase = await figma.clientStorage.getAsync('ux_agente_api_base');
      figma.ui.postMessage({ type: 'init', apiBase: typeof apiBase === 'string' ? apiBase : '' });
    } catch {
      figma.ui.postMessage({ type: 'init', apiBase: '' });
    }
    return;
  }
  if (msg.type === 'save-api-base') {
    try {
      await figma.clientStorage.setAsync('ux_agente_api_base', String(msg.apiBase || '').trim());
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
    if (!payload || payload.version !== 1) {
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
      const t = node.type;
      if (t === 'PAGE') {
        await figma.setCurrentPageAsync(node);
        parent = figma.currentPage;
      } else if (t === 'SECTION' || t === 'FRAME' || t === 'GROUP') {
        parent = node;
      } else {
        figma.ui.postMessage({
          type: 'error',
          text: `El nodo destino debe ser PAGE, SECTION, FRAME o GROUP (tipo actual: ${t}).`,
        });
        return;
      }
    }

    const { frameWidth: w, frameHeight: h, gap, startX, startY } = payload.layout;
    let x = startX;
    const created = [];
    for (const s of payload.screens) {
      const frame = figma.createFrame();
      frame.name = `${s.screenIndex}. ${s.name}`.slice(0, 120);
      frame.resize(w, h);
      frame.x = x;
      frame.y = startY;
      parent.appendChild(frame);
      created.push({ id: frame.id, name: frame.name });
      x += w + gap;
    }
    figma.ui.postMessage({ type: 'done', count: created.length, frames: created });
  } catch (e) {
    const err = e && typeof e === 'object' && 'message' in e ? String(e.message) : String(e);
    figma.ui.postMessage({ type: 'error', text: err });
  }
};
