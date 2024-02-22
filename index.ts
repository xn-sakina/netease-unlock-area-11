import { login_cellphone, recommend_songs } from 'NeteaseCloudMusicApi';
import fs from 'fs';
import path from 'path';
import cron from 'node-cron';
import prettier from 'prettier';
import { bootstrap } from 'global-agent';

proxySetup();
require('dotenv-flow').config();

const COOKIE_FILE = path.join(__dirname, './cookie.json');
const REFRESH_OUT_DIR = path.join(__dirname, './refresh_out');

const run = async () => {
  try {
    if (!fs.existsSync(REFRESH_OUT_DIR)) {
      fs.mkdirSync(REFRESH_OUT_DIR);
    }
    if (!fs.existsSync(COOKIE_FILE)) {
      await initialCookie();
    }
    const content = JSON.parse(fs.readFileSync(COOKIE_FILE, 'utf-8'));
    const cookie = content?.body?.cookie;
    if (!cookie?.length) {
      throw new Error('not cookie');
    }
    // refresh cookie
    const result = (await recommend_songs({
      cookie,
    })) as any as Partial<Daily>;
    const outPath = path.join(REFRESH_OUT_DIR, `./${Date.now()}.json`);
    fs.writeFileSync(
      outPath,
      prettier.format(JSON.stringify(result), {
        parser: 'json',
      }),
      'utf-8',
    );
    const dailySongs = result?.body?.data?.dailySongs?.length;
    if (result?.status === 200 && dailySongs && dailySongs > 6) {
      console.log('刷新列表成功');
    } else {
      console.log('刷新失败：', path.basename(outPath));
    }
  } catch (error) {
    console.log(error);
  }

  async function initialCookie() {
    console.log('第一次登录，获取初始 cookie ...');
    const result = await login_cellphone({
      phone: process.env.N_PHONE,
      password: process.env.N_PASSWORD,
    });
    if (result?.status === 400) {
      throw new Error('登录失败');
    }
    if (result?.body?.msg) {
      throw new Error(result.body.msg as string);
    }
    fs.writeFileSync(COOKIE_FILE, JSON.stringify(result), 'utf-8');
  }
};

run();

cron.schedule(`30 0 * * *`, () => {
  run();
});

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      readonly N_PHONE: string;
      readonly N_PASSWORD: string;
    }
  }
}

interface Daily {
  status: number;
  body: {
    data: {
      dailySongs: any[];
    };
  };
}

/**
 * 设置 Node 代理
 * @param {string} [proxy] 系统代理
 * @param {string} [noProxy] 代理白名单
 */
export function proxySetup(proxy?: string, noProxy?: string) {
  if (proxy) {
    if (noProxy) process.env.GLOBAL_AGENT_NO_PROXY = noProxy;
    process.env.GLOBAL_AGENT_HTTP_PROXY = proxy;
    bootstrap();
  } else {
    // 看本地 SHELL 环境是否有配置代理
    const {
      NO_PROXY,
      no_proxy,
      HTTPS_PROXY,
      https_proxy,
      HTTP_PROXY,
      http_proxy,
      ALL_PROXY,
      all_proxy,
    } = process.env;

    if (NO_PROXY || no_proxy) {
      process.env.GLOBAL_AGENT_NO_PROXY = NO_PROXY || no_proxy;
    }
    if (
      HTTPS_PROXY ||
      https_proxy ||
      HTTP_PROXY ||
      http_proxy ||
      ALL_PROXY ||
      all_proxy
    ) {
      // 需要清除 process.env 中的代理配置
      process.env.HTTP_PROXY = '';
      process.env.http_proxy = '';
      process.env.HTTPS_PROXY = '';
      process.env.https_proxy = '';
      process.env.ALL_PROXY = '';
      process.env.all_proxy = '';
      process.env.GLOBAL_AGENT_HTTP_PROXY =
        HTTPS_PROXY ||
        https_proxy ||
        HTTP_PROXY ||
        http_proxy ||
        ALL_PROXY ||
        all_proxy;
      bootstrap();
    } else {
      // 本地 SHELL 环境没有配置代理的话，尝试从 .env.local 读取代理
      // dotenv.config()
      // const { NO_PROXY, PROXY } = process.env
      // if (NO_PROXY) process.env.GLOBAL_AGENT_NO_PROXY = NO_PROXY
      // if (PROXY) {
      //   process.env.GLOBAL_AGENT_HTTP_PROXY = PROXY
      //   bootstrap()
      // }
    }
  }
}
