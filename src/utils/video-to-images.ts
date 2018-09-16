/*
 * @Author: lijianzhang
 * @Date: 2018-09-13 22:02:42
 * @Last Modified by: lijianzhang
 * @Last Modified time: 2018-09-13 22:13:53
 */
export default async function videoToImages(fieldOrSrc: File | string) {
    if (fieldOrSrc instanceof File) {
        return [];
    } else {
        const video = document.createElement('video');
        video.controls = true;
        video.src = fieldOrSrc;
        let imgs: any[] = [];
        return new Promise((res, rej) => {
            try {
                let index = 0;
                video.onseeked = () => {
                    const canvas = document.createElement('canvas');
                    canvas.width = video.videoWidth;
                    canvas.height = video.videoHeight;
                    const ctx = canvas.getContext('2d')!;
                    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                    imgs.push(ctx);
                    // const src = canvas.toDataURL('imag/jpeg', 0.1);
                    // imgs.push(src);
                    next();
                }
                
                video.onloadeddata = () => {
                    next();
                }
                
                function next() {
                    if (index < video.duration) {
                        index += 20;
                        video.currentTime = index;
                    }else {
                        res(imgs);
                    }
                } 
            } catch (error) {
                rej(error);
            }           
        })
    }
}