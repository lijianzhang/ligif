import { GIFDecoder, GIFEncoder } from '../src';

(window as any).GIFEncoder = GIFEncoder;
(window as any).GIFDecoder = GIFDecoder;

document.getElementById('main').addEventListener('drop', test);
document.getElementById('main').addEventListener('dragover', (e) => {
    e.stopPropagation();
    e.preventDefault();
});

function test(e) {
    e.stopPropagation();
    e.preventDefault();

    const field = e.dataTransfer.files[0];
    const gif = new GIFDecoder();
    (window as any).gif = gif;
    gif.readData(field).then(gif => {
       gif.frames.forEach(f =>  document.body.appendChild(f.renderToCanvas().canvas));
            const gIFEncoder = new GIFEncoder(gif.width, gif.height);
            gIFEncoder.addFrames(gif.frames.map(f => ({ img: f.ctx!.canvas, delay: f.delay })));
            gIFEncoder.encode().then(() => {
                const img = document.createElement('img');
                img.src = URL.createObjectURL(gIFEncoder.toBlob());
                document.body.appendChild(img);
                const b = new GIFDecoder();
                (window as any).b = b;
                b.readCodes(gIFEncoder.codes).then(() => b.frames.forEach(f =>  document.body.appendChild(f.renderToCanvas().canvas)));
            });
        });
}

const img1 = document.getElementById('img1') as HTMLImageElement;
const img2 = document.getElementById('img2') as HTMLImageElement;
const img3 = document.getElementById('img3') as HTMLImageElement;

const encoder = new GIFEncoder(img1.width, img1.height, { time: 10 });
encoder.addFrame({ img: img1, delay: 1000 });
encoder.addFrame({ img: img2, delay: 1000 });
encoder.addFrame({ img: img3, delay: 1000 });

encoder.encode().then(() => {
    const img = document.createElement('img');
    img.src = URL.createObjectURL(encoder.toBlob());
    document.body.appendChild(img);
});



// const field = document.getElementById('file') as HTMLInputElement;
// field.onchange = () => {
//     const a = new GIFEncoder(320, 180);
//     a.encodeByVideo({ src: field.files[0], from: 1, to: 3, fps: 5 }).then(() => {
//         const img = document.createElement('img');
//         img.src = URL.createObjectURL(a.toBlob());
//         document.body.appendChild(img);
//         const b = new GIFDecoder();
//         b.readCodes(a.codes).then(() => {
//             b.frames.forEach(f => document.body.appendChild(f.renderToCanvas().canvas));
//         });
//     });
// };
