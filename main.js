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
window.onload = () => {
    updateMuxInputs();
    updateEdInputs();
};

function startMultiplexing() {
    if (currentFdmAnim) cancelAnimationFrame(currentFdmAnim);

    const type   = $('mux-type').value;
    const output = $('mux-output');

    if (type === 'fdm') {
        const canvas = $('canvas-mux-fdm');
        const ctx = canvas.getContext('2d');

        const freqs  = [1,2,3].map(i => parseFloat($(`fdm-f${i}`).value) || [10,20,35][i-1]);
        const colors = ['#e74c3c','#2ecc71','#9b59b6'];

        output.innerHTML = `<strong>FDM Simulation (Static)</strong><br>
        <div style="margin-top:10px;padding:10px;background:#f0f0f0;border-left:4px solid #cc0000;color:#000;font-family:sans-serif;font-size:14px">
        <strong>Explanation:</strong> Each signal is assigned a different frequency (${freqs.join('Hz, ')}Hz) and all are transmitted simultaneously. Below is a static representation.
        </div>`;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const w = canvas.width - 60;
        const rowH = canvas.height / 4;
        const sx = 40;

        // Draw individual signals
        freqs.forEach((freq, idx) => {
            ctx.fillStyle = '#000';
            ctx.font = 'bold 12px Consolas';
            ctx.fillText(`CH${idx+1} (${freq}Hz)`, sx, 20 + idx*rowH - 5);

            ctx.beginPath();
            ctx.strokeStyle = colors[idx];
            ctx.lineWidth = 2;

            let midY = 20 + idx*rowH + rowH/2;
            ctx.moveTo(sx, midY);

            for (let i = 0; i < w; i++) {
                let y = Math.sin(i/w * Math.PI * 2 * freq);
                ctx.lineTo(sx + i, midY - y * (rowH/2 - 15));
            }
            ctx.stroke();
        });

        // Composite signal
        ctx.fillStyle = '#000';
        ctx.font = 'bold 12px Consolas';
        ctx.fillText('Composite Output', sx, 20 + rowH*3 - 5);

        ctx.beginPath();
        ctx.strokeStyle = '#34495e';
        ctx.lineWidth = 2.5;

        let midY = 20 + rowH*3 + rowH/2;
        ctx.moveTo(sx, midY);

        for (let i = 0; i < w; i++) {
            let combined = freqs.reduce((s, f) => s + Math.sin(i/w*Math.PI*2*f), 0) / freqs.length;
            ctx.lineTo(sx + i, midY - combined * (rowH/2 - 5));
        }
        ctx.stroke();

    } else {
        // ----------- STATIC TDM GRAPH -----------
        const canvas = document.createElement('canvas');
        canvas.width = 800;
        canvas.height = 400;

        const container = $('tdm-anim-container');
        container.innerHTML = '';
        container.appendChild(canvas);

        const ctx = canvas.getContext('2d');

        const sources  = [1,2,3].map(i => $(`mux-s${i}`).value.trim() || '0');
        const colors   = ['#34495e','#2ecc71','#e74c3c'];

        const maxLen = Math.max(...sources.map(s => s.length));

        output.innerHTML = `<strong>TDM Simulation (Static)</strong><br>
        <div style="margin-top:10px;padding:10px;background:#f0f0f0;border-left:4px solid #cc0000;color:#000;font-family:sans-serif;font-size:14px">
        <strong>Explanation:</strong> Each time slot takes one bit from each source sequentially. Below shows fixed frame-based multiplexing.
        </div>`;

        const startX = 80;
        const startY = 50;
        const boxW = 40;
        const boxH = 40;

        // Draw source rows
        sources.forEach((src, row) => {
            ctx.fillStyle = '#000';
            ctx.font = 'bold 12px Consolas';
            ctx.fillText(`S${row+1}`, 20, startY + row*60 + 25);

            ctx.beginPath();
            ctx.strokeStyle = colors[row];
            ctx.lineWidth = 3;

            [...src].forEach((bit, i) => {
                ctx.fillStyle = 'rgba(0,0,0,0.6)';
                ctx.fillText(bit, startX + i*boxW + 15, startY + row*60 - 5);

                let y = bit === '1' ? startY + row*60 : startY + row*60 + boxH;
                let currX = startX + i*boxW;
                
                if (i === 0) {
                    ctx.moveTo(currX, y);
                } else {
                    ctx.lineTo(currX, y);
                }
                ctx.lineTo(currX + boxW, y);
            });
            ctx.stroke();

            ctx.beginPath();
            ctx.strokeStyle = '#bdc3c7';
            ctx.setLineDash([5, 5]);
            ctx.lineWidth = 1;
            ctx.moveTo(startX, startY + row*60 + boxH);
            ctx.lineTo(startX + src.length*boxW, startY + row*60 + boxH);
            ctx.stroke();
            ctx.setLineDash([]);
            
            ctx.beginPath();
            ctx.strokeStyle = 'rgba(0,0,0,0.05)';
            ctx.lineWidth = 1;
            for(let i=0; i<=src.length; i++) {
                ctx.moveTo(startX + i*boxW, startY + row*60 - 10);
                ctx.lineTo(startX + i*boxW, startY + row*60 + boxH + 10);
            }
            ctx.stroke();
        });

        // Draw TDM output row
        let yOut = startY + 220;
        ctx.fillStyle = '#000';
        ctx.font = 'bold 12px Consolas';
        ctx.fillText('TDM Output', 20, yOut + 25);

        let tdmBits = [];
        for (let i = 0; i < maxLen; i++) {
            for (let ch = 0; ch < 3; ch++) {
                tdmBits.push({ bit: sources[ch][i] || '0', color: colors[ch] });
            }
        }

        let x = startX;
        for (let j = 0; j < tdmBits.length; j++) {
            let item = tdmBits[j];
            let y = item.bit === '1' ? yOut : yOut + boxH;
            
            ctx.fillStyle = item.color;
            ctx.fillText(item.bit, x + 15, yOut - 5);

            ctx.beginPath();
            ctx.strokeStyle = item.color;
            ctx.lineWidth = 3;
            
            if (j === 0) {
                ctx.moveTo(x, y);
            } else {
                let prevY = tdmBits[j-1].bit === '1' ? yOut : yOut + boxH;
                ctx.moveTo(x, prevY);
                ctx.lineTo(x, y);
            }
            ctx.lineTo(x + boxW, y);
            ctx.stroke();

            ctx.beginPath();
            ctx.strokeStyle = 'rgba(0,0,0,0.1)';
            ctx.lineWidth = 1;
            ctx.moveTo(x + boxW, yOut - 10);
            ctx.lineTo(x + boxW, yOut + boxH + 10);
            ctx.stroke();

            x += boxW;
        }

        ctx.beginPath();
        ctx.strokeStyle = '#bdc3c7';
        ctx.setLineDash([5, 5]);
        ctx.lineWidth = 1;
        ctx.moveTo(startX, yOut + boxH);
        ctx.lineTo(x, yOut + boxH);
        ctx.stroke();
        ctx.setLineDash([]);
    }
}

// ----------------------------------------------------
// MODULE 3: ERROR DETECTION
// ----------------------------------------------------
function updateEdInputs() {
    const method = $('ed-method').value;
    $('ed-crc-divisor').style.display = method === 'crc' ? 'flex' : 'none';
    const c2 = $('ed-checksum-data2');
    if (c2) c2.style.display = method === 'checksum' ? 'flex' : 'none';
    const l1 = $('ed-data-label');
    if (l1) l1.innerText = method === 'checksum' ? 'Data Block 1:' : 'Data Block:';
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
        const data2 = $('ed-data2') ? $('ed-data2').value.trim() : '';
        if (!isBin(data2)) { view.innerHTML = "<span style='color:red'>Invalid Block 2 binary input.</span>"; return; }

        const maxLen = Math.max(data.length, data2.length);
        if (maxLen > 16) { view.innerHTML = "<span style='color:red'>Data too large (max 16 bits advised for visualization).</span>"; return; }

        const d1 = data.padStart(maxLen, '0');
        const d2 = data2.padStart(maxLen, '0');

        printStep(`<strong>Checksum Calculation (${maxLen}-bit segments):</strong>`);
        printStep(`Block 1: <span style="font-family:monospace">${d1}</span> (${parseInt(d1, 2)})`);
        printStep(`Block 2: <span style="font-family:monospace">${d2}</span> (${parseInt(d2, 2)})`);
        printStep(`<hr style="border:0.5px dashed #ccc; margin: 4px 0;">`);

        let sum = parseInt(d1, 2) + parseInt(d2, 2);
        let binSum = sum.toString(2);
        printStep(`<i>Adding blocks...</i>`);
        printStep(`Initial Sum: <span style="font-family:monospace">${binSum}</span> (${sum})`);

        let maxVal = Math.pow(2, maxLen) - 1;
        while (sum > maxVal) { 
            let carry = sum >> maxLen; 
            sum = (sum & maxVal) + carry; 
        }

        let wrappedSum = sum.toString(2).padStart(maxLen, '0');
        if (wrappedSum !== binSum.padStart(maxLen, '0')) {
            printStep(`With Carry Wrapped: <span style="font-family:monospace">${wrappedSum}</span> (${sum})`);
        }

        let chk = (~sum) & maxVal;
        let binChk = chk.toString(2).padStart(maxLen, '0');

        printStep(`Sum = <span style="font-family:monospace">${wrappedSum}</span> → 1's Complement = <strong style="color:#e74c3c;font-family:monospace">${binChk}</strong>`);
        printStep(`<strong>Transmitted Data:</strong> <span style="background:#2ecc71;color:#fff;padding:4px;font-family:monospace">${d1} ${d2} ${binChk}</span>`);
        
        printStep(`<hr style="border:0.5px dashed #ccc; margin: 15px 0 5px 0;">`);
        printStep(`<strong>Receiver Side Validation:</strong>`);
        
        let rxSum = parseInt(d1, 2) + parseInt(d2, 2) + parseInt(binChk, 2);
        printStep(`Adding: <span style="font-family:monospace">${d1}</span> + <span style="font-family:monospace">${d2}</span> + Checksum: <strong style="color:#e74c3c;font-family:monospace">${binChk}</strong>`);
        
        let rxBinSum = rxSum.toString(2);
        printStep(`Sum = <span style="font-family:monospace">${rxBinSum}</span> (${rxSum})`);
        
        while (rxSum > maxVal) { 
            let carry = rxSum >> maxLen; 
            rxSum = (rxSum & maxVal) + carry; 
        }
        
        let rxWrappedSum = rxSum.toString(2).padStart(maxLen, '0');
        if (rxWrappedSum !== rxBinSum.padStart(maxLen, '0')) {
            printStep(`With Carry Wrapped: <span style="font-family:monospace">${rxWrappedSum}</span>`);
        }
        
        let isAllOnes = rxWrappedSum.indexOf('0') === -1;
        if (isAllOnes) {
            printStep(`<h3 style="color:#2ecc71; margin-top:5px; margin-bottom:5px;">Result: ${rxWrappedSum} ✓ (All 1s - No Error)</h3>`);
        } else {
            printStep(`<h3 style="color:#e74c3c; margin-top:5px; margin-bottom:5px;">Result: ${rxWrappedSum} ✗ (Error Detected)</h3>`);
        }

        printStep(explBox('Checksum adds blocks with carry wrap-around, then inverts to produce the checksum. The receiver repeats the addition including the checksum; all-1s means error-free.'));
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
