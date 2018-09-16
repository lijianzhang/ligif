/*
 * @Author: lijianzhang
 * @Date: 2018-09-16 00:10:40
 * @Last Modified by: lijianzhang
 * @Last Modified time: 2018-09-16 18:59:42
 */
interface IOpiton {
    methodType: number;
    useInputFlag: boolean;
    transparentColorIndex?: number;
    delay: number;
    transparentColorFlag: boolean;
}

export default class Frame {
    constructor(option: IOpiton) {
        this.methodType = option.methodType;
        this.useInputFlag = option.useInputFlag;
        this.delay = option.delay;
        this.transparentColorIndex = option.transparentColorIndex || 0;
        this.transparentColorFlag = option.transparentColorFlag;
    }

    x = 0;
    y = 0;
    w = 0;
    h = 0;

    isLocalColor = false;

    isInterlace = false;

    isSort = false;

    sizeOfLocalColors = 0;

    colors: number[] = [];

    methodType: number;

    useInputFlag: boolean;

    transparentColorIndex: number;

    delay: number;

    transparentColorFlag: boolean;

    imgPoints: number[] = []
    
    setImageData(data: number[]) {
        const colors = this.colors;
        data.forEach((index) => {
            this.imgPoints.push(colors[index * 3]);
            this.imgPoints.push(colors[index * 3 + 1]);
            this.imgPoints.push(colors[index * 3 + 2]);
            this.imgPoints.push(this.transparentColorFlag && index === this.transparentColorIndex ? 0 : 255);
        });
        // let i = 0;

        // let points: number[][][] = [];
        // for (let x = 0; x < this.w; x++) {
        //     points[x] = [];
        //     for (let y = 0; y < this.h; y++) {
        //         points[x][y] =  [colors[data[i] * 3], colors[data[i] * 3 + 1], colors[data[i] * 3 + 2]];
        //         i += 1;
        //     }
        // }
        // console.log(points);
    }
}