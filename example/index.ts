import Gif from '../src/gif';
import GIFEncoder from '../src/gif-encoder';
import Frame from '../src/frame';

(window as any).Gif =Gif;
(window as any).GIFEncoder =GIFEncoder;

document.getElementById('main').addEventListener('drop', function (e) {
    e.stopPropagation();
    e.preventDefault();

    const field = e.dataTransfer.files[0];
    const gif = new Gif();
    gif.readData(field).then(gif => {
    //    gif.frames.forEach(f =>  document.body.appendChild(f.renderToCanvas().canvas));
       gif.frames.forEach(f =>  f.renderToCanvas().canvas);
        (window as any).gif = gif;
        setTimeout(() => {
            const gIFEncoder = new GIFEncoder();
            (window as any).gIFEncoder = gIFEncoder;
            gIFEncoder.addFrames(gif.frames);
            gif.frames.forEach((f, i) => {
                if (i !== 0) {
                    f.x = 0;
                    f.y = 0;
                    f.w = f.width;
                    f.h = f.height;
                    f.delay = f.delay;
                    f.pixels = Array.from(f.ctx.getImageData(0, 0, f.w, f.h).data);
                }
            })
            console.time('generate');
            gIFEncoder.generate().then(() => {
                console.timeEnd('generate');
                const img = document.createElement('img');
                img.src = URL.createObjectURL(gIFEncoder.toBlob());
                document.body.appendChild(img);
                // const b = new Gif();
                // (window as any).b = b;
                // b.readCodes(gIFEncoder.codes).then(() => {
                //     b.frames.forEach(f => document.body.appendChild(f.renderToCanvas().canvas));
                // })
            });
        })

    });
});
document.getElementById('main').addEventListener('dragover', function(e) {
    e.stopPropagation();
    e.preventDefault();
});

const img = document.getElementById('img') as HTMLImageElement;

setTimeout(() => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = img.width;
    canvas.height = img.height;

    ctx.drawImage(img, 0, 0);
    const frame = new Frame();
    frame.pixels = Array.from(ctx.getImageData(0, 0, canvas.width, canvas.height).data);
    frame.w = canvas.width;
    frame.h = canvas.height;
    const encoder = new GIFEncoder();
    encoder.addFrame(frame);
    encoder.generate().then(() => {
        const decoder = new Gif();
        decoder.readCodes(encoder.codes).then(() => {
            decoder.frames.forEach(f => document.body.appendChild(f.renderToCanvas().canvas));
        });
    });
}, 1000);


