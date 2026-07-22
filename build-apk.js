import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const ANDROID_DIR = path.join(__dirname, 'android')
const PUBLIC_APK = path.join(__dirname, 'public', '7locar.apk')
const DEBUG_APK = path.join(ANDROID_DIR, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk')

console.log('')
console.log('╔══════════════════════════════════════════════════════════════╗')
console.log('║   🏁  BUILD AUTOMATIZADO DO APK - 7Locar / 7Boss           ║')
console.log('║   🔗  https://7locar.7all.com.br                            ║')
console.log('╚══════════════════════════════════════════════════════════════╝')
console.log('')

// ──────────────────────────────────────────
// DIAGNÓSTICO: Detectar Java e Android SDK
// ──────────────────────────────────────────

function findJavaHome() {
  // 1. Checar variável de ambiente existente
  if (process.env.JAVA_HOME && fs.existsSync(process.env.JAVA_HOME)) {
    return process.env.JAVA_HOME
  }

  // 2. Buscar em caminhos padrão do Windows
  const searchDirs = [
    'C:\\Program Files\\Java',
    'C:\\Program Files\\Eclipse Adoptium',
    'C:\\Program Files\\Microsoft',
    'C:\\Program Files\\Zulu',
    'C:\\Program Files\\Amazon Corretto',
    'C:\\Program Files\\BellSoft',
    'C:\\Program Files\\OpenJDK',
  ]

  const jdkPattern = /jdk[-_]?(1[7-9]|[2-9]\d)/i

  for (const dir of searchDirs) {
    if (!fs.existsSync(dir)) continue
    try {
      const entries = fs.readdirSync(dir).sort().reverse() // prefer newest
      for (const entry of entries) {
        const fullPath = path.join(dir, entry)
        if (fs.statSync(fullPath).isDirectory()) {
          // Check if it looks like a JDK 17+
          if (jdkPattern.test(entry) || entry.includes('17') || entry.includes('21') || entry.includes('22') || entry.includes('23')) {
            const javaBin = path.join(fullPath, 'bin', 'java.exe')
            if (fs.existsSync(javaBin)) return fullPath
          }
        }
      }
      // Fallback: any JDK in the directory
      for (const entry of entries) {
        const fullPath = path.join(dir, entry)
        const javaBin = path.join(fullPath, 'bin', 'java.exe')
        if (fs.existsSync(javaBin)) return fullPath
      }
    } catch (e) { /* skip */ }
  }

  // 3. Try to find via 'where java'
  try {
    const javaPath = execSync('where java', { encoding: 'utf8' }).trim().split('\n')[0].trim()
    if (javaPath) {
      // java.exe is in <JAVA_HOME>/bin/java.exe
      const binDir = path.dirname(javaPath)
      const home = path.dirname(binDir)
      if (fs.existsSync(home)) return home
    }
  } catch (e) { /* not found */ }

  return null
}

function findAndroidHome() {
  // 1. Checar variável existente
  if (process.env.ANDROID_HOME && fs.existsSync(process.env.ANDROID_HOME)) {
    return process.env.ANDROID_HOME
  }
  if (process.env.ANDROID_SDK_ROOT && fs.existsSync(process.env.ANDROID_SDK_ROOT)) {
    return process.env.ANDROID_SDK_ROOT
  }

  // 2. Caminhos comuns no Windows
  const userHome = process.env.USERPROFILE || process.env.HOME || ''
  const candidates = [
    path.join(userHome, 'AppData', 'Local', 'Android', 'Sdk'),
    path.join(userHome, 'Android', 'Sdk'),
    'C:\\Android\\Sdk',
    'C:\\android-sdk',
  ]

  for (const dir of candidates) {
    if (fs.existsSync(dir) && fs.existsSync(path.join(dir, 'platforms'))) {
      return dir
    }
  }

  return null
}

console.log('🔍 Diagnosticando ambiente...')
console.log('')

const javaHome = findJavaHome()
const androidHome = findAndroidHome()

let javaVersion = null
if (javaHome) {
  try {
    const javaBin = path.join(javaHome, 'bin', 'java')
    javaVersion = execSync(`"${javaBin}" -version 2>&1`, { encoding: 'utf8' }).trim().split('\n')[0]
  } catch (e) {
    try {
      javaVersion = execSync('java -version 2>&1', { encoding: 'utf8' }).trim().split('\n')[0]
    } catch (e2) { /* ignore */ }
  }
}

console.log(`   ☕ JAVA_HOME:    ${javaHome || '❌ NÃO ENCONTRADO'}`)
if (javaVersion) console.log(`   ☕ Java Version: ${javaVersion}`)
console.log(`   📱 ANDROID_HOME: ${androidHome || '❌ NÃO ENCONTRADO'}`)
console.log('')

// Verificar requisitos
const missingReqs = []
if (!javaHome) missingReqs.push('Java JDK 17+')
if (!androidHome) missingReqs.push('Android SDK')

if (missingReqs.length > 0) {
  console.error('╔══════════════════════════════════════════════════════════════╗')
  console.error('║   ❌ REQUISITOS NÃO ATENDIDOS                              ║')
  console.error('╚══════════════════════════════════════════════════════════════╝')
  console.error('')
  
  if (!javaHome) {
    console.error('   ❌ Java JDK 17+ não encontrado!')
    console.error('   📥 Baixe e instale em: https://adoptium.net/')
    console.error('      Escolha: Temurin 21 (LTS) > Windows x64 > .msi')
    console.error('      ⚠️  Marque a opção "Set JAVA_HOME" durante a instalação!')
    console.error('')
  }

  if (!androidHome) {
    console.error('   ❌ Android SDK não encontrado!')
    console.error('   📥 Instale o Android Studio: https://developer.android.com/studio')
    console.error('      Ou apenas os command-line tools:')
    console.error('      https://developer.android.com/studio#command-line-tools-only')
    console.error('')
  }

  console.error('   Após instalar, FECHE e REABRA o terminal, e rode:')
  console.error('   npm run build-apk')
  console.error('')
  process.exit(1)
}

// Configurar variáveis de ambiente para este processo
process.env.JAVA_HOME = javaHome
process.env.ANDROID_HOME = androidHome
process.env.ANDROID_SDK_ROOT = androidHome

// Adicionar Java e Android tools ao PATH
const javaBinDir = path.join(javaHome, 'bin')
const androidToolsDir = path.join(androidHome, 'platform-tools')
process.env.PATH = `${javaBinDir};${androidToolsDir};${process.env.PATH}`

console.log('   ✅ Ambiente configurado automaticamente!')
console.log('')

// ──────────────────────────────────────────
// STEP 1: Verificar dependências do Capacitor
// ──────────────────────────────────────────
const deps = ['@capacitor/core', '@capacitor/cli', '@capacitor/android']
console.log('📦 [1/5] Verificando dependências do Capacitor...')

try {
  const pkgJson = JSON.parse(fs.readFileSync('package.json', 'utf8'))
  let missing = false
  for (const dep of deps) {
    if (!pkgJson.dependencies?.[dep] && !pkgJson.devDependencies?.[dep]) {
      missing = true
      break
    }
  }
  
  if (missing) {
    console.log('   📥 Instalando dependências necessárias...')
    execSync('npm install --save @capacitor/core @capacitor/android', { stdio: 'inherit' })
    execSync('npm install --save-dev @capacitor/cli', { stdio: 'inherit' })
  } else {
    console.log('   ✅ Todas as dependências já instaladas.')
  }
} catch (err) {
  console.error('   ❌ Falha ao verificar/instalar dependências:', err.message)
  process.exit(1)
}

// ──────────────────────────────────────────
// STEP 1.5: Gerar Ícones e Splash Screens Nativos do App
// ──────────────────────────────────────────
console.log('🎨 [1.5/5] Gerando ícones e splash screens nativos...')
try {
  execSync('powershell -ExecutionPolicy Bypass -File pad_logo.ps1', { stdio: 'inherit' })
  console.log('   ✅ Ícones e splash screens atualizados com sucesso.')
} catch (err) {
  console.warn('   ⚠️ Falha ao gerar ícones nativos automaticamente via PowerShell:', err.message)
}

// ──────────────────────────────────────────
// STEP 2: Configurar capacitor.config.json
// ──────────────────────────────────────────
console.log('⚙️  [2/5] Configurando capacitor.config.json...')
const configContent = {
  appId: 'com.malaca.sevenlocar',
  appName: '7Locar',
  webDir: 'dist',
  server: {
    url: 'https://7locar.7all.com.br',
    cleartext: true
  }
}
fs.writeFileSync('capacitor.config.json', JSON.stringify(configContent, null, 2))
console.log('   ✅ Configuração salva.')

// ──────────────────────────────────────────
// STEP 3: Build da dist (se necessário) + Sync
// ──────────────────────────────────────────
console.log('🏗️  [3/5] Verificando build de produção...')
if (!fs.existsSync('dist')) {
  execSync('npm run build', { stdio: 'inherit' })
} else {
  console.log('   ✅ dist/ já existe.')
}

if (!fs.existsSync(ANDROID_DIR)) {
  console.log('   📱 Inicializando plataforma Android...')
  execSync('npx cap add android', { stdio: 'inherit' })
}

console.log('🔄 [4/5] Sincronizando web assets para o Android...')
try {
  execSync('npx cap sync android', { stdio: 'inherit' })
} catch (err) {
  console.warn('   ⚠️ Sync falhou, continuando...')
}

// ──────────────────────────────────────────
// STEP 4: COMPILAR O APK COM GRADLE
// ──────────────────────────────────────────
console.log('')
console.log('🔨 [5/5] COMPILANDO APK COM GRADLE...')
console.log('   (Pode levar 1-3 minutos na primeira vez)')
console.log('')

const gradleCmd = process.platform === 'win32' ? 'gradlew.bat' : './gradlew'

try {
  execSync(`"${path.join(ANDROID_DIR, gradleCmd)}" assembleDebug`, { 
    cwd: ANDROID_DIR, 
    stdio: 'inherit',
    env: process.env
  })
} catch (err) {
  console.error('')
  console.error('╔══════════════════════════════════════════════════════════════╗')
  console.error('║   ❌ FALHA NA COMPILAÇÃO DO GRADLE                         ║')
  console.error('╚══════════════════════════════════════════════════════════════╝')
  console.error('')
  console.error(`   JAVA_HOME:    ${javaHome}`)
  console.error(`   ANDROID_HOME: ${androidHome}`)
  console.error(`   Java:         ${javaVersion || 'desconhecido'}`)
  console.error('')
  console.error('   Possível solução:')
  console.error('   1. Verifique se o JDK é versão 17 ou superior')
  console.error('   2. Abra o Android Studio → SDK Manager')
  console.error('      Instale: "Android SDK Build-Tools" e "Android SDK Platform 36"')
  console.error('   3. Feche e reabra o terminal e rode: npm run build-apk')
  console.error('')
  
  // Tentar capturar log de erro detalhado do Gradle
  try {
    const gradleLog = execSync(`"${path.join(ANDROID_DIR, gradleCmd)}" assembleDebug --stacktrace 2>&1`, {
      cwd: ANDROID_DIR,
      encoding: 'utf8',
      env: process.env
    })
    console.error('   📋 Log do Gradle:')
    console.error(gradleLog.split('\n').slice(-30).join('\n'))
  } catch (e2) {
    const output = e2.stdout || e2.stderr || ''
    if (output) {
      console.error('   📋 Log do Gradle (últimas 30 linhas):')
      console.error(output.split('\n').slice(-30).join('\n'))
    }
  }
  
  process.exit(1)
}

// ──────────────────────────────────────────
// STEP 5: COPIAR APK PARA PUBLIC
// ──────────────────────────────────────────
if (fs.existsSync(DEBUG_APK)) {
  const stats = fs.statSync(DEBUG_APK)
  const sizeMB = (stats.size / (1024 * 1024)).toFixed(2)
  
  fs.copyFileSync(DEBUG_APK, PUBLIC_APK)
  
  console.log('')
  console.log('╔══════════════════════════════════════════════════════════════╗')
  console.log('║   ✅ APK COMPILADO E PRONTO PARA DEPLOY!                   ║')
  console.log('╚══════════════════════════════════════════════════════════════╝')
  console.log('')
  console.log(`   📦 Tamanho: ${sizeMB} MB`)
  console.log(`   📂 Salvo em: public/7locar.apk`)
  console.log('')
  console.log('   🚀 Agora rode: npm run deploy')
  console.log('')
} else {
  console.error('   ❌ APK não encontrado em:', DEBUG_APK)
  console.error('   Verifique: android/app/build/outputs/apk/')
  process.exit(1)
}
