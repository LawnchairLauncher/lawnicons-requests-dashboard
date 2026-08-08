// scripts/lint_icons.js — SVG linter for browser, 1:1 port of Python lint_icons.py
// Active rules: C01, C05, C06, C07, O01

/**
 * Parse CSS style attribute into key-value map
 * @param {string|null} styleStr
 * @returns {Object<string,string>}
 */
function parseStyleAttribute(styleStr) {
  if (!styleStr) return {};
  const result = {};
  const pairs = styleStr.toLowerCase().matchAll(/([\w-]+)\s*:\s*([^;]+)/g);
  for (const [, key, val] of pairs) {
    result[key] = val.trim();
  }
  return result;
}

/**
 * Parse opacity value like "0.5" or "50%" to integer percentage, or null if >=1
 * @param {string} val
 * @returns {number|null}
 */
function parseOpacity(val) {
  val = val.trim().toLowerCase();
  try {
    if (val.endsWith('%')) {
      return parseInt(val);
    }
    const opacityVal = parseFloat(val);
    if (opacityVal >= 1.0) return null;
    return Math.round(opacityVal * 100);
  } catch (e) {
    return null;
  }
}

/**
 * Lint SVG content, return array of issue strings (empty = pass)
 * @param {string} content
 * @returns {string[]}
 */
function lintSVG(content) {
  const issues = [];

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(content, 'image/svg+xml');
    const root = doc.documentElement;

    if (!root || root.tagName !== 'svg') {
      return ['Not a valid SVG'];
    }

    // C01: Canvas size 192x192
    const vbStr = root.getAttribute('viewBox') || '';
    const vb = vbStr.split(/\s+/);
    const w = (root.getAttribute('width') || '').replace('px', '');
    const h = (root.getAttribute('height') || '').replace('px', '');
    const hasCorrectViewBox = vb.length === 4 && vb[0] === '0' && vb[1] === '0' && vb[2] === '192' && vb[3] === '192';
    const hasCorrectSize = w === '192' && h === '192';

    if (!hasCorrectViewBox && !hasCorrectSize) {
      const width = vb[2] || w || '?';
      const height = vb[3] || h || '?';
      issues.push(`canvas: ${width}×${height} px`);
    }

    // C05: Effects (opacity, filter)
    const allElements = root.querySelectorAll('*');
    const forbiddenAttrs = ['opacity', 'fill-opacity', 'stroke-opacity', 'stop-opacity', 'filter'];
    const forbiddenStyleProps = new Set(forbiddenAttrs);
    const effects = new Set();
    const opacities = new Set();

    allElements.forEach(el => {
      const tag = el.tagName;
      if (tag === 'filter') {
        effects.add('filter');
      } else if (tag.startsWith('FE') || tag.startsWith('fe')) {
        effects.add('shadow or effect');
      }

      for (const attr of forbiddenAttrs) {
        const val = el.getAttribute(attr);
        if (!val) continue;

        const normalized = val.trim().toLowerCase();
        if (attr.includes('opacity')) {
          const opacityPct = parseOpacity(normalized);
          if (opacityPct !== null) opacities.add(opacityPct);
          continue;
        }

        if (attr === 'filter') {
          effects.add(
            normalized.includes('shadow') || normalized.includes('blur')
              ? 'shadow or effect'
              : 'filter'
          );
        } else {
          effects.add(attr);
        }
      }

      const styleVal = el.getAttribute('style');
      if (styleVal) {
        const styleMap = parseStyleAttribute(styleVal);
        for (const [prop, value] of Object.entries(styleMap)) {
          if (!forbiddenStyleProps.has(prop)) continue;

          const normalized = value.trim().toLowerCase();
          if (prop.includes('opacity')) {
            const opacityPct = parseOpacity(normalized);
            if (opacityPct !== null) opacities.add(opacityPct);
            continue;
          }

          if (prop === 'filter') {
            effects.add(
              normalized.includes('shadow') || normalized.includes('blur')
                ? 'shadow or effect'
                : 'filter'
            );
          } else {
            effects.add(prop);
          }
        }
      }
    });

    for (const op of [...opacities].sort((a, b) => a - b)) {
      issues.push(`opacity: ${op}%`);
    }

    if (effects.size > 0) {
      if (effects.has('shadow or effect')) {
        issues.push('shadow or effect: yes');
      } else if (effects.has('filter')) {
        issues.push('filter: yes');
      } else {
        for (const effect of [...effects].sort()) {
          issues.push(`${effect}: yes`);
        }
      }
    }

    // C06: Stroke weight
    const validWeights = new Set([6, 8, 10, 12, 14]);
    const strokes = [];

    allElements.forEach(el => {
      const sw = el.getAttribute('stroke-width');
      if (sw) {
        const val = parseFloat(sw.replace('px', '').trim());
        if (!isNaN(val)) {
          strokes.push(val);
        } else {
          issues.push(`stroke: ${sw}`);
        }
      }
    });

    if (strokes.length > 0) {
      const uniqueWeights = new Set(strokes);
      const forbidden = [...uniqueWeights].filter(w => !validWeights.has(w));
      if (forbidden.length > 0) {
        issues.push(`stroke: ${forbidden.sort((a, b) => a - b).join(', ')} px`);
      }
    }

    // C07: Fill color
    const allowedColors = new Set(['none', 'transparent', '#000000', '#000', 'black']);
    let hasFill = false;

    const rootStyle = parseStyleAttribute(root.getAttribute('style'));
    const rootFill = (rootStyle['fill'] || root.getAttribute('fill') || 'black').toLowerCase();

    const stack = [{ el: root, inheritedFill: rootFill }];

    while (stack.length > 0) {
      const { el, inheritedFill } = stack.pop();
      const tag = el.tagName;

      const localStyle = parseStyleAttribute(el.getAttribute('style'));
      const localStroke = (localStyle['stroke'] || el.getAttribute('stroke') || '').toLowerCase();
      const localFill = localStyle['fill'] || el.getAttribute('fill');
      const currentFill = localFill ? localFill.toLowerCase() : inheritedFill;

      if (['defs', 'style', 'clipPath', 'linearGradient', 'radialGradient', 'g', 'svg'].includes(tag)) {
        for (const child of el.children) {
          stack.push({ el: child, inheritedFill: currentFill });
        }
        continue;
      }

      if (currentFill !== 'none' && currentFill !== 'transparent') {
        hasFill = true;
      }

      if (localStroke) {
        if (!allowedColors.has(localStroke)) {
          issues.push(`color: ${localStroke}`);
        }
        if (!localFill && currentFill === 'black') {
          issues.push('fill: implicit black');
        }
      }

      for (const child of el.children) {
        stack.push({ el: child, inheritedFill: currentFill });
      }
    }

    if (hasFill) {
      issues.push('fill: yes');
    }

    // O01: SVG size
    const sizeKb = new Blob([content]).size / 1024;
    if (sizeKb > 3) {
      issues.push(`size: ${sizeKb.toFixed(1)} KB`);
    }

  } catch (e) {
    issues.push('Error parsing SVG');
  }

  return issues;
}