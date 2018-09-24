import GIFDecoder from '../src/gif-decoder';
import GIFEncoder from '../src/gif-encoder';
import Frame from '../src/frame';

(window as any).GIFDecoder =GIFDecoder;
(window as any).GIFEncoder =GIFEncoder;

document.getElementById('main').addEventListener('drop', function (e) {
    e.stopPropagation();
    e.preventDefault();

    const field = e.dataTransfer.files[0];
    const gif = new GIFDecoder();
    gif.readData(field).then(gif => {
    //    gif.frames.forEach(f =>  document.body.appendChild(f.renderToCanvas().canvas));
       gif.frames.forEach(f =>  f.renderToCanvas().canvas);
        (window as any).gif = gif;
        setTimeout(() => {
            const gIFEncoder = new GIFEncoder(gif.frames[0].w, gif.frames[0].h);
            (window as any).gIFEncoder = gIFEncoder;
            gIFEncoder.addFrames(gif.frames);



            gIFEncoder.encode().then(() => {
                const img = document.createElement('img');
                img.src = URL.createObjectURL(gIFEncoder.toBlob());
                document.body.appendChild(img);
                const b = new GIFDecoder();
                // debugger;
                // (window as any).b = b;
                b.readCodes(gIFEncoder.codes).then(() => {
                    b.frames.forEach(f => document.body.appendChild(f.renderToCanvas().canvas));
                })
            });
        })

    });
});
document.getElementById('main').addEventListener('dragover', function(e) {
    e.stopPropagation();
    e.preventDefault();
});

const img1 = document.getElementById('img1') as HTMLImageElement;
const img2 = document.getElementById('img2') as HTMLImageElement;
const img3 = document.getElementById('img3') as HTMLImageElement;
const img4 = document.getElementById('img4') as HTMLImageElement;

setTimeout(() => {
    // const canvas = document.createElement('canvas');
    // const ctx = canvas.getContext('2d');
    // canvas.width = img.width;
    // canvas.height = img.height;

    // ctx.drawImage(img, 0, 0);

    const encoder = new GIFEncoder(img1.width, img1.height);
    encoder.addFrame({ img: img1 });
    encoder.addFrame({ img: img2 });
    encoder.addFrame({ img: img3 });
    encoder.addFrame({ img: img4 });

    encoder.encode().then(() => {
        const img = document.createElement('img');
        img.src = URL.createObjectURL(encoder.toBlob());
        document.body.appendChild(img);
        // const decoder = new Gif();
        // decoder.readCodes(encoder.codes).then(() => {
        //     decoder.frames.forEach(f => document.body.appendChild(f.renderToCanvas().canvas));
        // });
    });
}, 1000);


