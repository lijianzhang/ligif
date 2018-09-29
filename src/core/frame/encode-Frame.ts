/*
 * @Author: lijianzhang
 * @Date: 2018-09-30 02:53:35
 * @Last Modified by: lijianzhang
 * @Last Modified time: 2018-09-30 03:23:02
 */

import BaseFrame from './base-frame';

export default class EncodeFrame extends BaseFrame
    implements LiGif.IEncodeFrame {
    public indexs = [];

    public displayType = 0;
}
