import Gif from '../src/gif';
import GIFEncoder from '../src/gif-encoder';
import Frame from '../src/frame';
import LzwDecode from '../src/lzw-decode';

(window as any).Gif =Gif;
(window as any).GIFEncoder =GIFEncoder;

document.getElementById('main').addEventListener('drop', function (e) {
    e.stopPropagation();
    e.preventDefault();

    const field = e.dataTransfer.files[0];
    const gif = new Gif();
    gif.readData(field).then(gif => {
        gif.frames.forEach(f => document.body.appendChild(f.renderToCanvas().canvas));
        (window as any).gif = gif;
        const gIFEncoder = new GIFEncoder();
        (window as any).gIFEncoder = gIFEncoder;
        gIFEncoder.frames = gif.frames;
        gIFEncoder.generate();
        const b = new Gif();
        (window as any).b = b;
        b.readCodes(gIFEncoder.codes);
        b.frames.forEach(f => document.body.appendChild(f.renderToCanvas().canvas));

    });
});
document.getElementById('main').addEventListener('dragover', function(e) {
    e.stopPropagation();
    e.preventDefault();
});

const img = document.getElementById('img') as HTMLImageElement;

// setTimeout(() => {
//     console.log(123);
//     const canvas = document.createElement('canvas');
//     const ctx = canvas.getContext('2d');
//     canvas.width = img.width;
//     canvas.height = img.height;

//     ctx.drawImage(img, 0, 0);
//     // canvas.toBlob((res) => {
//     const frame = new Frame();
//     frame.pixels = Array.from(ctx.getImageData(0, 0, canvas.width, canvas.height).data);
//     frame.w = canvas.width;
//     frame.h = canvas.height;
//     const encoder = new GIFEncoder();
//     encoder.addFrame(frame);
//     encoder.generate(1);
//     const decoder = new Gif();
//     decoder.readCodes(encoder.codes);
//     decoder.frames.forEach(f => document.body.appendChild(f.renderToCanvas().canvas));
// }, 1000);

// setTimeout(() => {
//     const canvas = document.createElement('canvas');
//     const ctx = canvas.getContext('2d');
//     canvas.width = 584;
//     canvas.height = 691;
//     ctx.drawImage(document.getElementById('img') as any, 584, 691);
//     const gIFEncoder = new GIFEncoder();
//     // ****
//     let pixels = [];
//     ctx.getImageData(0, 0, 200, 200).data.forEach((v, i) => {
//         if (i % 4 !== 0) {
//             pixels.push(v);
//         }
//     });
//     console.log('pixels=======');
//     console.log(gIFEncoder.generatePalette(pixels, 10));
//     console.log('pixels=======');
// }, 1000);

