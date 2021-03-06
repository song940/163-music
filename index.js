const URI = require('url');
const http = require('http');
const pack = require('./pack');
const crypto = require('crypto');
const EventEmitter = require('events');
const querystring = require('querystring');

const md5 = data => {
  const buf = Buffer.from(data)
  const str = buf.toString('binary')
  return crypto.createHash("md5").update(str).digest('hex')
}

const pickey = id => {
  const magic = '3go8&$8*3*3h0k(2)2'.split('')
  const song_id = id.split('').map((item, index) => {
    return String.fromCharCode(item.charCodeAt() ^ (magic[index % magic.length]).charCodeAt())
  })
  const md5Code = md5(song_id.join(''))
  const base64Code = Buffer.from(md5Code, 'hex').toString('base64')
  return base64Code.replace(/\//g, '_').replace(/\+/g, '-')
}

class NeteaseMusic extends EventEmitter {
  constructor(options) {
    super();
    Object.assign(this, {
      api: 'http://music.163.com/',
      secret: '7246674226682325323F5E6544673A51',
      cookie: 'os=pc; osver=Micr  osoft-Windows-10-Professional-build-10586-64bit; appver=2.0.3.131777; channel=netease; __remember_me=true',
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 9_1 like Mac OS X) AppleWebKit/601.1.46 (KHTML, like Gecko) Version/9.0 Mobile/13B143 Safari/601.1'
    }, options);
  }
  /**
   * encrypt
   * @param {*} body 
   */
  encrypt(body) {
    const { secret } = this;
    const password = pack('H*', secret)
    const cipher = crypto.createCipheriv('aes-128-ecb', password, '')
    body = JSON.stringify(body);
    body = cipher.update(body, 'utf8', 'base64') + cipher.final('base64')
    const hex = Buffer.from(body, 'base64').toString('hex')
    return hex.toUpperCase();
  }
  /**
   * request
   * @param {*} path 
   * @param {*} params 
   */
  request(path, params) {
    const {
      method,
      body,
      headers = {}
    } = params;
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    headers['Content-Length'] = Buffer.byteLength(body);
    const { hostname } = URI.parse(this.api);
    return new Promise((resolve, reject) => {
      const req = http.request({
        hostname,
        path,
        method,
        headers
      }, (res, buffer = []) => {
        res
          .on('error', reject)
          .on('data', chunk => buffer.push(chunk))
          .on('end', () => {
            res.data = Buffer.concat(buffer)
            res.text = () => Promise.resolve(res.data.toString());
            res.json = () => res.text().then(JSON.parse);
            resolve(res);
          });
      });
      req.write(body);
      req.end();
    });
  }
  /**
   * invoke
   * @param {*} method 
   * @param {*} path 
   * @param {*} params 
   */
  invoke(method, path, params) {
    const { userAgent, cookie, api } = this;
    return this.request('/api/linux/forward', {
        method: 'POST',
        headers: {
          cookie,
          referer: api,
          'user-agent': userAgent,
        },
        body: querystring.stringify({
          eparams: this.encrypt({
            method,
            params,
            url: api + path,
          })
        })
      })
      .then(res => res.json())
      .then(res => {
        if (res.code === 200) return res;
        const err = new Error(res.msg);
        err.code = res.code;
        err.data = res;
        throw err;
      })
  }
  /**
   * search
   * @param {*} keyword 
   * @param {*} offset 
   * @param {*} limit 
   */
  search(keyword, offset = 0, limit = 10) {
    return this.invoke('POST', '/api/cloudsearch/pc', {
      s: keyword,
      type: 1,
      limit,
      offset,
      total: true,
    });
  }
  /**
   * artist
   * @param {*} id 
   * @param {*} limit 
   */
  artist(id, limit = 50) {
    return this.invoke('GET', `/api/v1/artist/${id}`, {
      id,
      ext: true,
      top: limit
    });
  }
  /**
   * playlist
   * @param {*} id 
   */
  playlist(id) {
    return this.invoke('POST', '/api/v3/playlist/detail', {
      id
    });
  }
  /**
   * album
   * @param {*} id 
   */
  album(id) {
    return this.invoke('GET', `/api/v1/album/${id}`, {
      id
    });
  }
  /**
   * song
   * @param {*} ids 
   */
  song(ids) {
    if(!Array.isArray(ids)) ids = [ ids ];
    ids = ids.map(id => ({ id }));
    return this.invoke('POST', '/api/v3/song/detail', {
      c: JSON.stringify(ids)
    });
  }
  /**
   * url
   * @param {*} ids 
   * @param {*} br 
   */
  url(ids, br = 320) {
    if(!Array.isArray(ids)) ids = [ ids ];
    return this.invoke('POST', '/api/song/enhance/player/url', {
      ids,
      br: br * 1000
    });
  }
  /**
   * lyric
   * @param {*} id 
   */
  lyric(id) {
    return this.invoke('POST', '/api/song/lyric', {
      id,
      os: 'linux',
      lv: -1,
      kv: -1,
      tv: -1,
    });
  }
  /**
   * picture
   * @param {*} id 
   * @param {*} size 
   */
  picture(id, size = 300) {
    return Promise.resolve({
      code: 200,
      url: `https://p3.music.126.net/${pickey(id)}/${id}.jpg?param=${size}y${size}`
    });
  }
}

module.exports = NeteaseMusic;
