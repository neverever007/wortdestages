// Führe aus mit: node generate-assets.js
const zlib = require('zlib');
const fs   = require('fs');

function makePNG(w, h, r, g, b) {
  const sig  = Buffer.from([137,80,78,71,13,10,26,10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w,0); ihdr.writeUInt32BE(h,4);
  ihdr[8]=8; ihdr[9]=2; // 8-bit RGB

  // Eine Zeile: filter-byte + Pixel
  const row = Buffer.alloc(1 + w*3);
  for (let x=0; x<w; x++) { row[1+x*3]=r; row[2+x*3]=g; row[3+x*3]=b; }
  const raw = Buffer.concat(Array.from({length:h}, () => row));
  const idat = zlib.deflateSync(raw);

  // CRC32
  const tbl = new Uint32Array(256);
  for (let i=0;i<256;i++){let c=i;for(let j=0;j<8;j++)c=(c&1)?(0xEDB88320^(c>>>1)):(c>>>1);tbl[i]=c;}
  const crc = b=>{let c=0xFFFFFFFF;for(const x of b)c=tbl[(c^x)&255]^(c>>>8);return(c^0xFFFFFFFF)>>>0;};
  const chunk = (type,data)=>{
    const l=Buffer.alloc(4); l.writeUInt32BE(data.length);
    const t=Buffer.from(type,'ascii');
    const cc=Buffer.alloc(4); cc.writeUInt32BE(crc(Buffer.concat([t,data])));
    return Buffer.concat([l,t,data,cc]);
  };
  return Buffer.concat([sig, chunk('IHDR',ihdr), chunk('IDAT',idat), chunk('IEND',Buffer.alloc(0))]);
}

fs.mkdirSync('assets', {recursive:true});
fs.writeFileSync('assets/icon.png',              makePNG(1024,1024, 0xE8,0x83,0x54)); // orange
fs.writeFileSync('assets/adaptive-icon.png',     makePNG(1024,1024, 0xE8,0x83,0x54)); // orange
fs.writeFileSync('assets/splash-icon.png',       makePNG(1024,1024, 0x17,0x13,0x10)); // dunkel
fs.writeFileSync('assets/notification-icon.png', makePNG(  96,  96, 0xFF,0xFF,0xFF)); // weiß
console.log('Fertig! 4 PNG-Dateien in assets/ erstellt.');
