import Gif from '../src/gif';
import GIFEncoder from '../src/gif-encoder';

(window as any).Gif =Gif;
(window as any).GIFEncoder =GIFEncoder;

document.getElementById('main').addEventListener('drop', function (e) {
    e.stopPropagation();
    e.preventDefault();

    const field = e.dataTransfer.files[0];
    const gif = new Gif();
    gif.readData(field).then(gif => {
        gif.frames.forEach(f => document.body.appendChild(f.renderToCanvas().canvas));
        const gIFEncoder = new GIFEncoder();
        gIFEncoder.frames = gif.frames;
        gIFEncoder.generate(1, 2);
        const b = new Gif();
        b.readCodes(gIFEncoder.codes);
        b.frames.forEach(f => document.body.appendChild(f.renderToCanvas().canvas));
        (window as any).gIFEncoder = gIFEncoder;

    });
});
document.getElementById('main').addEventListener('dragover', function(e) {
    e.stopPropagation();
    e.preventDefault();
});

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

