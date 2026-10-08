import {normalize} from './rank.mjs';
// These are text clues, not a claim that all artifacts are released or runnable.
export function recipeSignals(item){
  const text=normalize(`${item.title||''} ${item.rankingText||item.description||''}`);
  const checks=[
    ['code','代码／开源线索',/open source|open sourced|github|training code|code available|code release|implementation|训练代码|开源/],
    ['params','参数／配置线索',/hyperparameter|learning rate|batch size|training config|training recipe|training script|ablation|超参数|学习率|调参/],
    ['data','数据处理线索',/dataset|data mixture|data curation|data cleaning|decontamination|deduplication|synthetic data|数据集|数据清洗|数据构造/],
    ['thinking','Thinking 数据线索',/reasoning trace|reasoning trajector|thinking data|chain of thought|long cot|reasoning data|thought distillation|思维链|思考数据/]
  ];
  return checks.filter(([, ,regex])=>regex.test(text)).map(([id,label])=>({id,label}));
}
