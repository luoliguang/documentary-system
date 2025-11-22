/**
 * 数组工具函数
 * 用于比较数组是否真正发生变化
 */

/**
 * 深度比较两个数组是否相等（忽略顺序）
 * @param arr1 第一个数组
 * @param arr2 第二个数组
 * @returns 如果数组内容相同（忽略顺序），返回 true
 */
export function arraysEqualIgnoreOrder<T>(arr1: T[] | null | undefined, arr2: T[] | null | undefined): boolean {
  // 处理 null/undefined
  if (!arr1 && !arr2) return true;
  if (!arr1 || !arr2) return false;
  
  // 长度不同，肯定不同
  if (arr1.length !== arr2.length) return false;
  
  // 转换为 Set 进行比较（忽略顺序和重复）
  const set1 = new Set(arr1);
  const set2 = new Set(arr2);
  
  // 检查每个元素是否都在另一个集合中
  if (set1.size !== set2.size) return false;
  
  for (const item of set1) {
    if (!set2.has(item)) return false;
  }
  
  return true;
}

/**
 * 深度比较两个数组是否完全相等（包括顺序）
 * @param arr1 第一个数组
 * @param arr2 第二个数组
 * @returns 如果数组完全相同，返回 true
 */
export function arraysEqual<T>(arr1: T[] | null | undefined, arr2: T[] | null | undefined): boolean {
  // 处理 null/undefined
  if (!arr1 && !arr2) return true;
  if (!arr1 || !arr2) return false;
  
  // 长度不同，肯定不同
  if (arr1.length !== arr2.length) return false;
  
  // 逐个比较
  for (let i = 0; i < arr1.length; i++) {
    if (arr1[i] !== arr2[i]) {
      return false;
    }
  }
  
  return true;
}

/**
 * 比较两个对象数组是否相等（基于某个唯一字段）
 * @param arr1 第一个数组
 * @param arr2 第二个数组
 * @param keyField 用于比较的唯一字段（如 'id', 'number' 等）
 * @returns 如果数组内容相同，返回 true
 */
export function objectArraysEqual<T extends Record<string, any>>(
  arr1: T[] | null | undefined,
  arr2: T[] | null | undefined,
  keyField: keyof T
): boolean {
  // 处理 null/undefined
  if (!arr1 && !arr2) return true;
  if (!arr1 || !arr2) return false;
  
  // 长度不同，肯定不同
  if (arr1.length !== arr2.length) return false;
  
  // 提取唯一字段的值进行比较
  const values1 = new Set(arr1.map(item => item[keyField]).filter(v => v != null));
  const values2 = new Set(arr2.map(item => item[keyField]).filter(v => v != null));
  
  if (values1.size !== values2.size) return false;
  
  for (const value of values1) {
    if (!values2.has(value)) return false;
  }
  
  return true;
}

