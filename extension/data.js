'use strict';
(() => {
  // PUBLIC_EXAMPLE_DATA：本文件只包含虚构示例，请替换为自己的真实信息。
  const date = (value) => ({ label: '', value, kind: 'date' });
  const period = (start, end) => [
    { ...start, label: '开始时间' },
    end ? { ...end, label: '结束时间' } : { label: '结束时间', value: '至今', kind: 'text' },
    { label: '起止时间', kind: 'period', start, end }
  ];
  const item = (name, fields) => ({ name, fields });
  const layouts = [
    { name: '基本信息', fields: [
      { label: '姓名', value: '示例用户', kind: 'text' },
      { label: '电话', value: '13800000000', kind: 'text' },
      { label: '邮箱', value: 'example@example.com', kind: 'text' },
      { label: '性别', value: '女', kind: 'text' },
      { ...date('2000-01-01'), label: '出生日期' }
    ] },
    { name: '教育经历', items: [
      item('示例大学 · 硕士', [
        { label: '学校', value: '示例大学', kind: 'text' },
        { label: '学院名称', value: '计算机学院', kind: 'text' },
        { label: '学历', value: '硕士', kind: 'text' },
        { label: '专业', value: '网络空间安全', kind: 'text' },
        ...period(date('2023-09-01'), date('2026-06-30')),
        { label: '校园实践经历', value: '参与校内技术社团，组织基础安全知识分享。', kind: 'text' }
      ]),
      item('样例学院 · 本科', [
        { label: '学校', value: '样例学院', kind: 'text' },
        { label: '学历', value: '本科', kind: 'text' },
        { label: '专业', value: '计算机科学与技术', kind: 'text' },
        ...period(date('2019-09-01'), date('2023-06-30'))
      ])
    ] },
    { name: '实习与实践', items: [
      item('示例科技有限公司', [
        { label: '公司名称', value: '示例科技有限公司', kind: 'text' },
        { label: '职位', value: '安全实习生', kind: 'text' },
        ...period(date('2025-07-01'), date('2025-09-30')),
        { label: '工作内容', value: '协助整理安全告警并编写数据处理脚本。', kind: 'text' }
      ])
    ] },
    { name: '项目经历', items: [
      item('示例安全工具', [
        { label: '项目名称', value: '示例安全工具', kind: 'text' },
        ...period(date('2025-03-01'), date('2025-06-30')),
        { label: '项目内容', value: '使用 Python 实现日志解析与风险信息汇总。', kind: 'text' }
      ])
    ] },
    { name: '专业技能', fields: [
      { label: '专业技能', value: '熟悉 Python、Linux 和常见 Web 安全基础知识。', kind: 'text' }
    ] },
    { name: '荣誉证书', items: [
      item('示例竞赛二等奖', [
        { label: '名称', value: '示例竞赛二等奖', kind: 'text' },
        { label: '奖项级别', value: '校级', kind: 'text' },
        { ...date('2025-05-30'), label: '获奖时间' },
        { label: '颁发机构', value: '示例大学', kind: 'text' }
      ])
    ] },
    { name: '英语', items: [
      item('CET-6', [
        { label: '名称', value: 'CET-6', kind: 'text' },
        { label: '分数', value: '500', kind: 'text' },
        { ...date('2023-12-30'), label: '取得时间' },
        { label: '颁发机构', value: '教育部教育考试院', kind: 'text' }
      ]),
      item('CET-4', [
        { label: '名称', value: 'CET-4', kind: 'text' },
        { label: '分数', value: '520', kind: 'text' },
        { ...date('2022-06-30'), label: '取得时间' },
        { label: '颁发机构', value: '教育部教育考试院', kind: 'text' }
      ])
    ] },
    { name: '自我评价', fields: [
      { label: '长', value: '具备计算机与网络安全基础，能够使用 Python 编写工具，并持续学习新的安全技术。', kind: 'text' },
      { label: '短', value: '具备网络安全基础和 Python 开发能力。', kind: 'text' }
    ] }
  ];
  globalThis.RESUME_LAYOUTS = layouts;
})();
