// 허브(sujifather)·통합검색기와 같은 Firebase 프로젝트. compat SDK는 index.html <script>로 로드됨.
const firebaseConfig = {
  apiKey: "AIzaSyAF0-GXeRRrtUsdQgS3L-CjkAL4eUrM3cc",
  authDomain: "search-alluniv.firebaseapp.com",
  projectId: "search-alluniv",
  storageBucket: "search-alluniv.firebasestorage.app",
  messagingSenderId: "395338642740",
  appId: "1:395338642740:web:c902a7e5f39e61adce2161",
}

let db = null
export function getDb() {
  if (!db) {
    if (!window.firebase) throw new Error('Firebase SDK가 로드되지 않았습니다')
    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig)
    db = firebase.firestore()
  }
  return db
}
export const FieldValue = () => firebase.firestore.FieldValue
