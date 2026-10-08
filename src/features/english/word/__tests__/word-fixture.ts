import type { EnglishTextbook } from '@/data/textbooks';

export const fixtureTb: EnglishTextbook = {
  textbook: '小学英语（测试夹具）',
  grades: [
    {
      grade: 1,
      volumes: [
        {
          volume: 1,
          volume_name: '上册',
          units: [
            {
              unit: 1,
              title: 'Unit 1 Animals',
              words: [
                { en: 'cat', zh: '猫', ipa: '/kæt/' },
                { en: 'dog', zh: '狗', ipa: '/dɒɡ/' },
                { en: 'apple', zh: '苹果', ipa: '/ˈæpl/' },
                { en: 'bird', zh: '鸟', ipa: '/bɜːd/' },
                { en: 'egg', zh: '蛋', ipa: '/eɡ/' },
                { en: 'fish', zh: '鱼', ipa: '/fɪʃ/' },
                { en: 'cow', zh: '奶牛', ipa: '/kaʊ/' },
                { en: 'pig', zh: '猪', ipa: '/pɪɡ/' },
                { en: 'hen', zh: '母鸡', ipa: '/hen/' },
                { en: 'duck', zh: '鸭子', ipa: '/dʌk/' },
              ],
              sentences: [
                { en: 'I see a cat.', zh: '我看见一只猫。' },
                { en: 'The dog is big.', zh: '这只狗很大。' },
                { en: 'I like apples.', zh: '我喜欢苹果。' },
                { en: 'Is this a bird?', zh: '这是一只鸟吗？' },
                { en: 'Have an egg, please.', zh: '请吃个蛋。' },
                { en: 'The fish can swim.', zh: '鱼会游泳。', zhNote: 'can 会、能' },
                { en: 'Look at the cow.', zh: '看那头奶牛。' },
                { en: 'This pig is fat.', zh: '这头猪很胖。' },
                { en: 'The hen is white.', zh: '这只母鸡是白色的。' },
                { en: 'A duck swims well.', zh: '鸭子游得很好。', zhNote: 'well 好地' },
              ],
            },
            {
              unit: 2,
              title: 'Unit 2 Forest',
              words: [
                { en: 'fox', zh: '狐狸', ipa: '/fɒks/' },
                { en: 'rabbit', zh: '兔子', ipa: '/ˈræbɪt/' },
              ],
              sentences: [],
            },
          ],
        },
        {
          volume: 2,
          volume_name: '下册',
          units: [
            {
              unit: 1,
              title: 'Unit 1 Zoo',
              words: [
                { en: 'tiger', zh: '老虎', ipa: '/ˈtaɪɡə/' },
                { en: 'monkey', zh: '猴子', ipa: '/ˈmʌŋki/' },
              ],
              sentences: [],
            },
          ],
        },
      ],
    },
    {
      grade: 2,
      volumes: [
        {
          volume: 1,
          volume_name: '上册',
          units: [
            {
              unit: 1,
              title: 'Unit 1 Farm',
              words: [{ en: 'sheep', zh: '绵羊', ipa: '/ʃiːp/' }],
              sentences: [{ en: 'The sheep is white.', zh: '这只绵羊是白色的。' }],
            },
          ],
        },
      ],
    },
  ],
};

export const EN2ZH: Record<string, string> = {};
export const EN_IPA: Record<string, string> = {};
export const SENT_EN2ZH: Record<string, string> = {};
export const SENT_ZH2EN: Record<string, string> = {};
export const SENT_ZHNOTE: Record<string, string> = {};
for (const grade of fixtureTb.grades) {
  for (const vol of grade.volumes) {
    for (const unit of vol.units) {
      for (const w of unit.words) {
        EN2ZH[w.en] = w.zh;
        EN_IPA[w.en] = w.ipa ?? '';
      }
      for (const s of unit.sentences) {
        SENT_EN2ZH[s.en] = s.zh;
        SENT_ZH2EN[s.zh] = s.en;
        if (s.zhNote !== undefined) SENT_ZHNOTE[s.en] = s.zhNote;
      }
    }
  }
}
