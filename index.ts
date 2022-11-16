import { login_cellphone, recommend_songs } from 'NeteaseCloudMusicApi'
import fs from 'fs'
import path from 'path'
import cron from 'node-cron'
import prettier from 'prettier'

require('dotenv').config()

const COOKIE_FILE = path.join(__dirname, './cookie.json')
const REFRESH_OUT_DIR = path.join(__dirname, './refresh_out')

const run = async () => {
  try {
    if (!fs.existsSync(REFRESH_OUT_DIR)) {
      fs.mkdirSync(REFRESH_OUT_DIR)
    }
    if (!fs.existsSync(COOKIE_FILE)) {
      await initialCookie()
    }
    const content = JSON.parse(fs.readFileSync(COOKIE_FILE, 'utf-8'))
    const cookie = content?.body?.cookie
    if (!cookie?.length) {
      throw new Error('not cookie')
    }
    // refresh cookie
    const result = (await recommend_songs({
      cookie,
    })) as any as Partial<Daily>
    const outPath = path.join(REFRESH_OUT_DIR, `./${Date.now()}.json`)
    fs.writeFileSync(
      outPath,
      prettier.format(JSON.stringify(result), {
        parser: 'json',
      }),
      'utf-8'
    )
    const dailySongs = result?.body?.data?.dailySongs?.length
    if (result?.status === 200 && dailySongs && dailySongs > 6) {
      console.log('刷新列表成功')
    } else {
      console.log('刷新失败：', path.basename(outPath))
    }
  } catch (error) {
    console.log(error)
  }

  async function initialCookie() {
    const result = await login_cellphone({
      phone: process.env.N_PHONE,
      password: process.env.N_PASSWORD,
    })
    console.log('第一次登录，获取初始 cookie ...')
    fs.writeFileSync(COOKIE_FILE, JSON.stringify(result), 'utf-8')
  }
}

run()

cron.schedule(`30 0 * * *`, () => {
  run()
})

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      readonly N_PHONE: string
      readonly N_PASSWORD: string
    }
  }
}

interface Daily {
  status: number
  body: {
    data: {
      dailySongs: any[]
    }
  }
}
