// main.js - Refactored & Shortened

let currentFdmAnim = null, currentLcAnim = null;

// --- Helpers ---
const $  = id => document.getElementById(id);
const isBin = s => /^[01]+$/.test(s);

function showModule(id) {
    [currentFdmAnim, currentLcAnim].forEach(a => a && cancelAnimationFrame(a));
    document.querySelectorAll('.module').forEach(m => m.classList.remove('active'));
    document.querySelectorAll('nav button').forEach(b => b.classList.remove('active-btn'));
    $(id).classList.add('active');
    const btn = $(`btn-${id}`);
    if (btn) btn.classList.add('active-btn');
}

// ----------------------------------------------------
// MODULE 1: LINE CODING
// ----------------------------------------------------
const schemeProps = {
    'unipolar-nrz':   { dc:'Yes', bw:'N/2', sync:'No', expl:'Unipolar NRZ: 1→+V, 0→0V. High DC component; no self-sync on long identical runs.' },
    'polar-nrz-l':    { dc:'Yes', bw:'N/2', sync:'No', expl:'Polar NRZ-L: 1→-V, 0→+V. Better noise tolerance but still loses sync on long identical runs.' },
    'polar-nrz-i':    { dc:'Yes', bw:'N/2', sync:'No (long 0s)', expl:'Polar NRZ-I: transition on 1, hold on 0. Synced for 1s but drifts on extended 0s.' },
    'manchester':     { dc:'No',  bw:'N',   sync:'Yes', expl:'Manchester: mid-bit transition every bit. Eliminates DC, ensures sync, doubles bandwidth.' },
    'diff-manchester':{ dc:'No',  bw:'N',   sync:'Yes', expl:'Diff Manchester: mid-bit for clock, start-of-bit for data (transition=0, no transition=1). No DC, full sync.' },
    'ami':            { dc:'No',  bw:'N/2', sync:'No (long 0s)', expl:'AMI: 0→0V, 1s alternate ±V. DC-free with narrow bandwidth; sync lost over extended 0s.' }
};

function buildPoints(data, scheme) {
    const BW = 80, SX = 60, yH = 60, yZ = 150, yL = 240;
    let pts = [[SX, yZ]], x = SX, pol = yH, lastAmi = yL;

    for (const bit of data) {
        if (scheme === 'unipolar-nrz') {
            let y = bit === '1' ? yH : yZ;
            pts.push([x, y], [x+BW, y]);
        } else if (scheme === 'polar-nrz-l') {
            let y = bit === '1' ? yL : yH;
            pts.push([x, y], [x+BW, y]);
        } else if (scheme === 'polar-nrz-i') {
            if (bit === '1') pol = pol === yH ? yL : yH;
            pts.push([x, pol], [x+BW, pol]);
        } else if (scheme === 'manchester') {
            let [sY, eY] = bit === '1' ? [yH, yL] : [yL, yH];
            pts.push([x, sY], [x+BW/2, sY], [x+BW/2, eY], [x+BW, eY]);
        } else if (scheme === 'diff-manchester') {
            let sY = bit === '0' ? (pol === yH ? yL : yH) : pol;
            let eY = sY === yH ? yL : yH;
            pts.push([x, sY], [x+BW/2, sY], [x+BW/2, eY], [x+BW, eY]);
            pol = eY;
        } else if (scheme === 'ami') {
            let y = yZ;
            if (bit === '1') { y = lastAmi === yH ? yL : yH; lastAmi = y; }
            pts.push([x, y], [x+BW, y]);
        }
        x += BW;
    }

    // Build smooth path with vertical connectors
    let path = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
        let prev = path[path.length - 1], curr = pts[i];
        if (curr[0] > prev[0] && curr[1] !== prev[1]) path.push([curr[0], prev[1]]);
        path.push(curr);
    }
    return path;
}

function startLineCoding() {
    if (currentLcAnim) cancelAnimationFrame(currentLcAnim);
    const data   = $('lc-data').value.trim();
    const scheme = $('lc-scheme').value;
    const canvas = $('canvas-lc');
    const ctx    = canvas.getContext('2d');
    const output = $('lc-output');
    const hover  = $('lc-hover-info');

    if (!isBin(data)) { output.innerHTML = "<span style='color:#e74c3c'>Error: Binary only (0s and 1s).</span>"; return; }

    const BW = 80, SX = 60, yH = 60, yZ = 150, yL = 240;
    const w = canvas.width, h = canvas.height;
    const path = buildPoints(data, scheme);

    function drawBg() {
        ctx.clearRect(0, 0, w, h);
        ctx.lineWidth = 2; ctx.strokeStyle = '#2c3e50';
        ctx.beginPath(); ctx.moveTo(SX-20, yZ); ctx.lineTo(w-20, yZ); ctx.stroke();

        ctx.font = 'bold 14px Consolas'; ctx.fillStyle = '#34495e';
        ['+V', '0', '-V'].forEach((t, i) => ctx.fillText(t, 10, [yH, yZ, yL][i] + 5));

        ctx.strokeStyle = '#bdc3c7'; ctx.setLineDash([5, 5]); ctx.lineWidth = 1;
        for (let i = 0; i <= data.length; i++) {
            let bx = SX + i * BW;
            ctx.beginPath(); ctx.moveTo(bx, 20); ctx.lineTo(bx, h - 20); ctx.stroke();
            if (i < data.length) {
                ctx.fillStyle = '#e74c3c'; ctx.font = 'bold 18px Consolas';
                ctx.fillText(data[i], bx + BW/2 - 5, 30);
            }
        }
        ctx.setLineDash([]);
    }

    let progress = 0;
    function renderFrame() {
        drawBg();
        let done = progress >= path.length - 1;
        if (done) progress = path.length - 1;

        ctx.beginPath(); ctx.strokeStyle = '#2980b9'; ctx.lineWidth = 4;
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.moveTo(path[0][0], path[0][1]);
        let dm = Math.floor(progress);
        for (let i = 1; i <= dm; i++) ctx.lineTo(path[i][0], path[i][1]);

        let dotX, dotY;
        if (!done) {
            let p1 = path[dm], p2 = path[dm + 1], f = progress - dm;
            dotX = p1[0] + (p2[0]-p1[0])*f; dotY = p1[1] + (p2[1]-p1[1])*f;
            ctx.lineTo(dotX, dotY); ctx.stroke();
            progress += 0.5;
            currentLcAnim = requestAnimationFrame(renderFrame);
        } else {
            dotX = path[dm][0]; dotY = path[dm][1];
            ctx.stroke();
        }
        ctx.beginPath(); ctx.fillStyle = '#e74c3c';
        ctx.arc(dotX, dotY, 5, 0, Math.PI*2); ctx.fill();
    }
    renderFrame();

    const p = schemeProps[scheme];
    output.innerHTML = `<strong>${scheme.toUpperCase().replace(/-/g,' ')} Properties</strong><br>
DC: <b style="color:#3498db">${p.dc}</b> &nbsp;|&nbsp; BW: <b style="color:#3498db">${p.bw}</b> &nbsp;|&nbsp; Sync: <b style="color:#3498db">${p.sync}</b><br><br>
<div style="margin-top:8px;padding:10px;background:#f0f0f0;border-left:4px solid #cc0000;color:#000;font-family:sans-serif;font-size:14px"><strong>Explanation:</strong> ${p.expl}</div>`;

    canvas.onmousemove = e => {
        let r = canvas.getBoundingClientRect(), mx = e.clientX - r.left;
        let idx = Math.floor((mx - SX) / BW);
        if (idx >= 0 && idx < data.length) {
            hover.style.opacity = '1';
            hover.innerHTML = `Bit [${idx}] = ${data[idx]}`;
        } else hover.style.opacity = '0';
    };
    canvas.onmouseleave = () => hover.style.opacity = '0';
}


// ----------------------------------------------------
// MODULE 2: MULTIPLEXING
// ----------------------------------------------------
function updateMuxInputs() {
    const isTDM = $('mux-type').value === 'tdm';
    $('mux-tdm-inputs').style.display = isTDM ? 'flex' : 'none';
    $('mux-fdm-inputs').style.display = isTDM ? 'none' : 'flex';
    $('canvas-mux-fdm').style.display  = isTDM ? 'none' : 'block';
    $('tdm-anim-container').style.display = isTDM ? 'block' : 'none';
}
window.onload = updateMuxInputs;

function startMultiplexing() {
    if (currentFdmAnim) cancelAnimationFrame(currentFdmAnim);
    const type   = $('mux-type').value;
    const output = $('mux-output');

    if (type === 'fdm') {
        const canvas = $('canvas-mux-fdm'), ctx = canvas.getContext('2d');
        const freqs  = [1,2,3].map(i => parseFloat($(`fdm-f${i}`).value) || [10,20,35][i-1]);
        const colors = ['#e74c3c','#2ecc71','#9b59b6'];
        let phase = 0;

        output.innerHTML = `<strong>FDM Simulation Running</strong><br>
<div style="margin-top:10px;padding:10px;background:#f0f0f0;border-left:4px solid #cc0000;color:#000;font-family:sans-serif;font-size:14px"><strong>Explanation:</strong> FDM assigns each source a unique carrier frequency (${freqs.join('Hz, ')}Hz). The composite output is their summed analog signal transmitted simultaneously.</div>`;

        function drawLiveFDM() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            const w = canvas.width - 60, rowH = canvas.height / 4, sx = 40;

            freqs.forEach((freq, idx) => {
                ctx.fillStyle = '#000'; ctx.font = 'bold 12px Consolas';
                ctx.fillText(`CH${idx+1} (${freq}Hz)`, sx, 20 + idx*rowH - 5);
                ctx.beginPath(); ctx.strokeStyle = colors[idx]; ctx.lineWidth = 2;
                let midY = 20 + idx*rowH + rowH/2; ctx.moveTo(sx, midY);
                for (let i = 0; i < w; i += 2)
                    ctx.lineTo(sx+i, midY - Math.sin(i/w*Math.PI*2*freq - phase*freq*0.5)*(rowH/2-15));
                ctx.stroke();
            });

            ctx.fillStyle = '#000'; ctx.font = 'bold 12px Consolas';
            ctx.fillText('Composite Output', sx, 20 + rowH*3 - 5);
            ctx.beginPath(); ctx.strokeStyle = '#34495e'; ctx.lineWidth = 2.5;
            let midY = 20 + rowH*3 + rowH/2; ctx.moveTo(sx, midY);
            for (let i = 0; i < w; i += 2) {
                let combined = freqs.reduce((s, f) => s + Math.sin(i/w*Math.PI*2*f - phase*f*0.5), 0) / freqs.length;
                ctx.lineTo(sx+i, midY - combined*(rowH/2-5));
            }
            ctx.stroke();
            phase += 0.05;
            currentFdmAnim = requestAnimationFrame(drawLiveFDM);
        }
        drawLiveFDM();

    } else {
        const sources  = [1,2,3].map(i => $(`mux-s${i}`).value.trim() || '-');
        const colors   = ['#34495e','#2ecc71','#e74c3c'];
        const labels   = ['Buffer A:','Buffer B:','Buffer C:'];
        const yStarts  = [50, 120, 190];
        const maxLen   = Math.max(...sources.map(s => s.length));
        const container = $('tdm-anim-container');
        container.innerHTML = '';
        const targetY = 320;

        output.innerHTML = `<strong>TDM Simulation</strong><br>
<div style="margin-top:10px;padding:10px;background:#f0f0f0;border-left:4px solid #cc0000;color:#000;font-family:sans-serif;font-size:14px"><strong>Explanation:</strong> Synchronous TDM interleaves one bit per source into fixed time slots forming frames. Each column above maps one bit from each buffer to a composite output slot.</div>`;

        const addLabel = (txt, y) => {
            let el = Object.assign(document.createElement('div'), { innerHTML: txt });
            Object.assign(el.style, { position:'absolute', left:'20px', top:y+'px', fontFamily:'Consolas', fontWeight:'bold' });
            container.appendChild(el);
        };
        labels.forEach((l, i) => addLabel(l, yStarts[i]));
        addLabel('MUX Output Link:', targetY - 25);

        let bitsDOM = [];
        sources.forEach((src, ch) => {
            [...src].forEach((bStr, i) => {
                let b = Object.assign(document.createElement('div'), { className:'tdm-bit', innerText:bStr });
                Object.assign(b.style, { left:(120+i*35)+'px', top:yStarts[ch]+'px', backgroundColor:colors[ch] });
                container.appendChild(b);
                if (!bitsDOM[i]) bitsDOM[i] = [];
                bitsDOM[i][ch] = b;
            });
        });

        for (let i = 0; i < maxLen; i++) {
            let fb = document.createElement('div');
            fb.className = 'tdm-frame-box';
            Object.assign(fb.style, { width:'100px', height:'40px', left:(120+i*110)+'px', top:targetY+'px' });
            [0,1,2].forEach(s => {
                let slot = document.createElement('div');
                Object.assign(slot.style, { borderRight: s<2 ? '1px dashed #2c3e50' : '', width:'33px', height:'100%' });
                fb.appendChild(slot);
            });
            let lbl = Object.assign(document.createElement('span'), { innerText:`Frame ${i+1}` });
            Object.assign(lbl.style, { position:'absolute', bottom:'-20px', fontSize:'11px' });
            fb.appendChild(lbl); container.appendChild(fb);
        }

        let fi = 0, ci = 0;
        while (fi < maxLen) {
            let bitEl = bitsDOM[fi]?.[ci];
            if (bitEl) {
                bitEl.style.transition = 'none'; bitEl.style.zIndex = '10';
                let tx = 120 + fi*110 + ci*33 + 4;
                bitEl.style.transform = `translate(${tx - parseInt(bitEl.style.left)}px, ${targetY - parseInt(bitEl.style.top) + 6}px) scale(0.9)`;
            }
            if (++ci > 2) { ci = 0; fi++; }
        }
    }
}


// ----------------------------------------------------
// MODULE 3: ERROR DETECTION
// ----------------------------------------------------
function updateEdInputs() {
    $('ed-crc-divisor').style.display = $('ed-method').value === 'crc' ? 'flex' : 'none';
}

function startErrorDetection() {
    const data   = $('ed-data').value.trim();
    const method = $('ed-method').value;
    const view   = $('ed-visual-area');

    if (!isBin(data)) { view.innerHTML = "<span style='color:red'>Invalid binary input.</span>"; return; }
    view.innerHTML = '';

    const printStep = html => {
        let d = document.createElement('div');
        d.className = 'crc-step'; d.innerHTML = html;
        view.appendChild(d);
    };

    const explBox = txt => `<div style="margin-top:10px;padding:10px;background:#f0f0f0;border-left:4px solid #cc0000;color:#000;font-family:sans-serif;font-size:14px"><strong>Explanation:</strong> ${txt}</div>`;

    if (method === 'parity-even') {
        let ones   = [...data].filter(b => b==='1').length;
        let parity = ones % 2 === 0 ? '0' : '1';
        let visual = [...data].map(b => b==='1' ? `<span style="background:yellow;color:black">1</span>` : b).join('');
        printStep(`<strong>Data:</strong> ${data}`);
        printStep(`Highlighted 1s: <span style="letter-spacing:4px">${visual}</span>`);
        printStep(`Count of 1s = <strong>${ones}</strong> → Parity bit = <strong>${parity}</strong>`);
        printStep(`<strong>Transmitted:</strong> <span style="padding:4px;background:#2ecc71;color:#fff;border-radius:3px">${data} [${parity}]</span>`);
        printStep(explBox('Even parity ensures the total number of 1s is even. A single flipped bit changes this to odd, immediately flagging an error at the receiver.'));
    }

    else if (method === 'checksum') {
        let pad = data.padStart(Math.ceil(data.length/8)*8, '0');
        let chunks = pad.match(/.{8}/g);
        printStep(`<strong>Checksum (8-bit segments):</strong>`);
        chunks.forEach(c => printStep(`  ${c}`));

        let sum = chunks.reduce((s, c) => s + parseInt(c, 2), 0);
        printStep(`<i>Adding blocks with 1's complement wrapping...</i>`);
        chunks.forEach(c => printStep(`+ ${c} (${parseInt(c,2)})`));
        while (sum > 255) { let carry = sum >> 8; sum = (sum & 255) + carry; }

        let chk = (~sum) & 255, binChk = chk.toString(2).padStart(8,'0');
        printStep(`Sum = ${sum.toString(2).padStart(8,'0')} → 1's Complement = <strong style="color:#e74c3c">${binChk}</strong>`);
        printStep(`<strong>Transmitted:</strong> <span style="background:#2ecc71;color:#fff;padding:4px">${data} [${binChk}]</span>`);
        printStep(explBox('Checksum adds fixed-size blocks with carry wrap-around, then inverts to produce a checksum. Receiver adds all segments including checksum; all-1s means error-free.'));
    }

    else if (method === 'crc') {
        const poly = $('ed-poly').value.trim();
        if (!isBin(poly)) { view.innerHTML = "<span style='color:red'>Invalid Generator Poly.</span>"; return; }

        let rLen   = poly.length - 1;
        let temp   = (data + '0'.repeat(rLen)).split('');
        printStep(`<strong>CRC Division</strong>  Generator: <span class="crc-divisor">${poly}</span>`);
        printStep(`Augmented data: <span class="crc-dividend">${temp.join('')}</span>`);
        printStep(`<hr style="border:1px dashed #ccc">`);

        for (let i = 0; i <= temp.length - poly.length; i++) {
            if (temp[i] === '1') {
                let sp = '&nbsp;'.repeat(i);
                printStep(`<div class="crc-dividend">${temp.join('')}</div>`);
                printStep(`<div class="crc-divisor">${sp}${poly}</div>`);
                for (let j = 0; j < poly.length; j++) temp[i+j] = temp[i+j] === poly[j] ? '0' : '1';
                printStep(`<div class="crc-xor-result">${temp.join('')}</div>`);
            }
        }
        let rem = temp.join('').slice(-rLen);
        printStep(`<span style="padding:10px;background:#f4f6f9;border:2px solid #3498db">Remainder = <strong>${rem}</strong></span>`);
        printStep(`<strong>Transmitted:</strong> <span style="padding:6px;background:#2ecc71;color:#fff;border-radius:4px">${data} <strong>${rem}</strong></span>`);
        printStep(explBox('CRC divides the data by a generator polynomial using XOR (modulo-2) arithmetic. The remainder appended becomes the FCS; the receiver repeats the division—zero remainder confirms error-free receipt.'));
    }
}


// ----------------------------------------------------
// MODULE 4: ERROR CORRECTION (Hamming 7,4)
// ----------------------------------------------------
let lastCodeword = '';

function makeBit(val, label, isParity) {
    let b = document.createElement('div');
    b.className = `hamming-bit ${isParity ? 'parity' : 'data'}`;
    b.innerHTML = val;
    let l = document.createElement('span');
    l.className = 'bit-label'; l.innerText = label;
    b.appendChild(l);
    return b;
}

function generateHamming() {
    const data = $('ec-data').value.trim();
    if (!/^[01]{4}$/.test(data)) { alert('Enter exactly 4 binary bits.'); return; }
    const [d1,d2,d3,d4] = [...data].map(Number);
    const p1 = d1^d2^d4, p2 = d1^d3^d4, p4 = d2^d3^d4;
    lastCodeword = `${p1}${p2}${d1}${p4}${d2}${d3}${d4}`;

    const c = $('ec-gen-visual'); c.innerHTML = '';
    [[p1,'P1',1],[p2,'P2',1],[d1,'D1',0],[p4,'P4',1],[d2,'D2',0],[d3,'D3',0],[d4,'D4',0]]
        .forEach(([v,lbl,ip]) => c.appendChild(makeBit(v, lbl, ip)));

    $('ec-rx').value = lastCodeword;
    $('ec-det-visual').innerHTML = '<p>Codeword sent. Awaiting receiver input.</p>';
}

function injectRandomError() {
    const rx = $('ec-rx');
    if (rx.value.length !== 7) return;
    let chars = [...rx.value], idx = Math.floor(Math.random()*7);
    chars[idx] = chars[idx] === '1' ? '0' : '1';
    rx.value = chars.join('');
    rx.style.backgroundColor = '#ffcdd2';
    setTimeout(() => rx.style.backgroundColor = '#fff', 500);
}

function detectErrorHamming() {
    const rx = $('ec-rx').value.trim();
    if (!/^[01]{7}$/.test(rx)) return;

    const view = $('ec-det-visual');
    view.innerHTML = '';

    const labels = ['P1','P2','D1','P4','D2','D3','D4'];
    let bitRow = document.createElement('div'); bitRow.className = 'bit-container';
    let rxEls = labels.map((lbl, i) => {
        let isP = i===0||i===1||i===3;
        let b = makeBit(rx[i], lbl, isP);
        bitRow.appendChild(b); return b;
    });
    view.appendChild(bitRow);

    const [p1,p2,d1,p4,d2,d3,d4] = [...rx].map(Number);
    let logs = document.createElement('div'); view.appendChild(logs);
    const log = t => { let d = document.createElement('div'); d.innerHTML = t; logs.appendChild(d); };

    let s1 = p1^d1^d2^d4, s2 = p2^d1^d3^d4, s4 = p4^d2^d3^d4;
    let syn = s4*4 + s2*2 + s1;

    log('<br><b>Syndrome Calculation:</b>');
    log(`S1 = P1⊕D1⊕D2⊕D4 = <b style="color:red">${s1}</b>`);
    log(`S2 = P2⊕D1⊕D3⊕D4 = <b style="color:red">${s2}</b>`);
    log(`S4 = P4⊕D2⊕D3⊕D4 = <b style="color:red">${s4}</b>`);
    log(`Syndrome [${s4}${s2}${s1}] = <b style="font-size:18px">${syn}</b>`);
    log('<div style="margin-top:10px;padding:10px;background:#f0f0f0;border-left:4px solid #cc0000;color:#000;font-family:sans-serif;font-size:14px"><strong>Explanation:</strong> Hamming places parity bits at power-of-2 positions. The syndrome word (S4S2S1 in binary) directly gives the decimal index of the erroneous bit. Zero means no error.</div>');

    if (syn === 0) {
        log('<h3 style="color:#2ecc71">✓ No error detected. Data accepted.</h3>');
    } else {
        log(`<h3 style="color:#e74c3c">✗ Error at bit position ${syn}</h3>`);
        let el = rxEls[syn - 1];
        el.classList.add('error');
        setTimeout(() => {
            el.innerHTML = el.innerText === '1' ? '0' : '1';
            let lbl = document.createElement('span'); lbl.className = 'bit-label'; lbl.innerText = labels[syn-1];
            el.appendChild(lbl);
            el.classList.remove('error'); el.classList.add('corrected');
            log('<h3 style="color:#9b59b6">✓ Bit auto-corrected successfully.</h3>');
        }, 400);
    }
}
