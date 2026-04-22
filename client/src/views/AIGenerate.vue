<template>
  <div class="page">
    <div class="layout">
      <!-- 左栏：配置 -->
      <div class="config-panel">
        <div class="panel-title">生成配置</div>
        <t-form :data="config" label-width="90px" label-align="top">
          <t-form-item label="AI渠道">
            <t-select v-model="config.ai_config_id" placeholder="选择AI配置" clearable>
              <t-option v-for="c in aiConfigs" :key="c.id" :value="c.id" :label="c.name" />
            </t-select>
          </t-form-item>

          <t-form-item label="类型">
            <t-select v-model="config.type" placeholder="选择或输入类型" clearable filterable creatable style="width: 100%">
              <t-option v-for="t in typeOptions" :key="t.value" :value="t.value" :label="t.label" />
            </t-select>
          </t-form-item>

          <t-form-item label="类别">
            <t-select v-model="config.category" placeholder="选择或输入类别" clearable filterable creatable style="width: 100%">
              <t-option v-for="c in categoryOptions" :key="c.value" :value="c.value" :label="c.label" />
            </t-select>
          </t-form-item>

          <t-form-item label="是否拒答">
            <t-select v-model="config.is_refused" placeholder="不设置则由AI判断" clearable>
              <t-option :value="0" label="不拒答" />
              <t-option :value="1" label="拒答" />
            </t-select>
          </t-form-item>

          <t-form-item label="技能">
            <t-checkbox-group v-model="config.skills">
              <t-checkbox v-for="s in skills" :key="s.id" :value="s.id" :label="s.name" />
            </t-checkbox-group>
          </t-form-item>

          <t-form-item label="Prompt">
            <div class="prompt-wrapper">
              <t-textarea v-model="config.prompt" placeholder="输入生成题目的指令" :autosize="{ minRows: 4, maxRows: 8 }" />
              <div class="prompt-selector">
                <t-select
                  v-model="selectedPromptId"
                  placeholder="从Prompt库选择"
                  clearable
                  style="width: 100%"
                  @change="handlePromptSelect"
                >
                  <t-option v-for="p in prompts" :key="p.id" :value="p.id" :label="p.name" />
                </t-select>
              </div>
            </div>
          </t-form-item>

          <t-form-item label="生成数量">
            <t-input-number v-model="config.count" :min="1" :max="200" :step="1" />
          </t-form-item>

          <t-form-item label="并发数">
            <t-input-number v-model="config.concurrency" :min="1" :max="10" :step="1" />
            <div class="form-tip">同时并发调用AI的数量，默认5</div>
          </t-form-item>

          <t-form-item label="批量大小">
            <t-input-number v-model="config.batch_size" :min="1" :max="20" :step="1" />
            <div class="form-tip">每批生成题目数量，默认5</div>
          </t-form-item>

          <t-form-item>
            <t-button theme="primary" :loading="generating" @click="handleGenerate">
              <template #icon><t-icon name="chat" /></template>
              {{ generating ? `生成中 (${generatingProgress.current}/${generatingProgress.total})` : '生成题目' }}
            </t-button>
          </t-form-item>

          <t-form-item v-if="lastSentPrompt">
            <div class="last-prompt">
              <div class="last-prompt-label">最后发送的提示词：</div>
              <div class="last-prompt-content">{{ lastSentPrompt }}</div>
            </div>
          </t-form-item>
        </t-form>
      </div>

      <!-- 右栏：结果 -->
      <div class="result-panel">
        <div class="panel-title">
          生成结果
          <span class="result-count">{{ results.length }} 条</span>
        </div>

        <!-- 操作栏 -->
        <div class="toolbar">
          <t-button v-if="selectedRows.length" theme="danger" variant="outline" @click="handleBatchDelete">
            <template #icon><t-icon name="delete" /></template>
            批量删除 ({{ selectedRows.length }})
          </t-button>
          <t-button v-if="selectedRows.length" theme="primary" variant="outline" @click="handleBatchAdd">
            <template #icon><t-icon name="add" /></template>
            批量添加到测试集 ({{ selectedRows.length }})
          </t-button>
          <t-button v-if="results.length" variant="outline" @click="handleCheckDuplicates" :loading="checkingDuplicate">
            <template #icon><t-icon name="scan" /></template>
            重复检测
          </t-button>
          <t-button v-if="hasDuplicates" theme="danger" variant="outline" @click="handleDeleteDuplicates">
            <template #icon><t-icon name="delete" /></template>
            删除重复 ({{ duplicateCount }}条)
          </t-button>
        </div>

        <!-- 表格 -->
        <div class="table-wrapper">
          <t-table
            :data="results"
            :columns="columns"
            row-key="index"
            hover
            stripe
            :pagination="null"
            :selected-row-keys="selectedRows"
            @select-change="handleSelectChange"
            table-layout="fixed"
          >
            <template #is_refused="{ row }">
              <t-tag :theme="row.is_refused === 1 ? 'danger' : 'success'" variant="outline">
                {{ row.is_refused === 1 ? '是' : '否' }}
              </t-tag>
            </template>
            <template #is_duplicate="{ row }">
              <t-tooltip v-if="row.duplicate_with" :content="`重复于: ${row.duplicate_with}`" placement="top">
                <t-icon name="close-circle" style="color: #e34d59; font-size: 18px;" />
              </t-tooltip>
              <t-icon v-else-if="row.is_duplicate" name="close-circle" style="color: #e34d59; font-size: 18px;" />
              <t-icon v-else-if="row.checked !== false" name="check-circle" style="color: #00a870; font-size: 18px;" />
              <span v-else style="color: #bbb">-</span>
            </template>
            <template #action="{ row }">
              <t-button variant="text" size="small" theme="primary" @click="handleViewRaw(row)">查看原文</t-button>
              <t-button variant="text" size="small" theme="primary" @click="handleRegenerateAnswer(row)" :loading="regeneratingAnswer[row.index]">重新生成</t-button>
              <t-button variant="text" size="small" theme="primary" @click="handleEdit(row)">编辑</t-button>
              <t-button variant="text" size="small" theme="danger" @click="handleDelete(row)">删除</t-button>
              <t-button variant="text" size="small" theme="success" @click="handleAddToTestSet(row)">添加到测试集</t-button>
            </template>
            <template #answer-preview="{ row }">
              <span v-if="row.answer">{{ row.answer.substring(0, 50) }}{{ row.answer.length > 50 ? '...' : '' }}</span>
              <span v-else style="color: #bbb">无</span>
            </template>
          </t-table>

          <t-empty v-if="!results.length" description="暂无生成结果" />
        </div>

        <!-- 编辑弹窗 -->
        <t-dialog v-model:visible="editDialogVisible" header="编辑题目" :footer="false" width="600px">
          <t-form :data="editForm" @submit="handleEditSubmit" label-width="90px">
            <t-form-item label="题目" name="question">
              <t-textarea v-model="editForm.question" placeholder="请输入题目" :autosize="{ minRows: 3, maxRows: 6 }" />
            </t-form-item>
            <t-form-item label="回答" name="answer">
              <t-textarea v-model="editForm.answer" placeholder="请输入回答" :autosize="{ minRows: 3, maxRows: 6 }" />
            </t-form-item>
            <t-form-item label="类型" name="type">
              <t-input v-model="editForm.type" placeholder="类型" />
            </t-form-item>
            <t-form-item label="类别" name="category">
              <t-input v-model="editForm.category" placeholder="类别" />
            </t-form-item>
            <t-form-item label="是否拒答" name="is_refused">
              <t-select v-model="editForm.is_refused">
                <t-option :value="0" label="不拒答" />
                <t-option :value="1" label="拒答" />
              </t-select>
            </t-form-item>
            <t-form-item>
              <t-button type="submit" theme="primary">保存</t-button>
              <t-button variant="outline" @click="editDialogVisible = false" style="margin-left: 12px">取消</t-button>
            </t-form-item>
          </t-form>
        </t-dialog>

        <!-- 查看原文弹窗 -->
        <t-dialog v-model:visible="rawContentDialogVisible" header="AI原始响应" :footer="false" width="700px">
          <t-space direction="vertical" style="width: 100%" :size="16">
            <t-alert theme="info">题目：{{ rawContentQuestion }}</t-alert>
            <div>
              <h4 style="margin-bottom: 8px">原始响应内容</h4>
              <div class="raw-content-box">{{ rawContentText || '无原始内容' }}</div>
            </div>
            <div style="text-align: right">
              <t-button variant="outline" @click="rawContentDialogVisible = false">关闭</t-button>
            </div>
          </t-space>
        </t-dialog>

        <!-- 重新生成回答弹窗 -->
        <t-dialog v-model:visible="regenerateDialogVisible" header="重新生成回答" :footer="false" width="700px">
          <t-space direction="vertical" style="width: 100%" :size="16">
            <t-alert theme="info">题目：{{ regenerateForm.question }}</t-alert>
            <div class="ai-section">
              <h4 style="margin-bottom: 8px">原回答</h4>
              <div class="ai-answer-box">{{ regenerateForm.oldAnswer || '无' }}</div>
            </div>
            <div class="ai-section">
              <h4 style="margin-bottom: 8px">AI生成回答</h4>
              <div class="ai-answer-box ai-answer-new">{{ regenerateForm.newAnswer || '生成中...' }}</div>
            </div>
            <div style="text-align: right">
              <t-button variant="outline" @click="regenerateDialogVisible = false">关闭</t-button>
              <t-button theme="primary" style="margin-left: 12px" @click="handleUseNewAnswer" :disabled="!regenerateForm.newAnswer">使用新回答</t-button>
            </div>
          </t-space>
        </t-dialog>

        <!-- 确认删除弹窗 -->
        <t-dialog v-model:visible="confirmDialogVisible" header="确认删除" width="400px" :footer="false">
          <div style="padding: 8px 0;">{{ confirmDialogText }}</div>
          <div style="text-align: right;">
            <t-button variant="outline" @click="confirmDialogVisible = false">取消</t-button>
            <t-button theme="danger" style="margin-left: 12px" @click="handleConfirmDialog">确认删除</t-button>
          </div>
        </t-dialog>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue';
import { MessagePlugin } from 'tdesign-vue-next';
import { aiConfigAPI, aiGenerateAPI, questionsAPI } from '@/api';

const aiConfigs = ref([]);
const skills = ref([]);
const prompts = ref([]);
const selectedPromptId = ref(null);
const typeOptions = ref([]);
const categoryOptions = ref([]);

// 配置
const config = reactive({
  ai_config_id: null,
  type: '',
  category: '',
  is_refused: null,
  skills: [],
  prompt: '',
  count: 5,
  batch_size: 5,  // 每批数量
  concurrency: 5,  // 并发数
});

// 缓存键
const RESULTS_CACHE_KEY = 'ai_generate_results';
const CONFIG_CACHE_KEY = 'ai_generate_config';

// 生成结果
const results = ref([]);
const generating = ref(false);
const selectedRows = ref([]);
const checkingDuplicate = ref(false);
const regeneratingAnswer = ref({});
const generatingProgress = ref({ current: 0, total: 0 });
const lastSentPrompt = ref('');
let ws = null;

// 计算属性：是否有重复
const hasDuplicates = computed(() => results.value.some(r => r.is_duplicate));
const duplicateCount = computed(() => results.value.filter(r => r.is_duplicate).length);

// 保存结果到缓存
const saveResultsToCache = () => {
  localStorage.setItem(RESULTS_CACHE_KEY, JSON.stringify(results.value));
};

// 加载结果从缓存
const loadResultsFromCache = () => {
  const cached = localStorage.getItem(RESULTS_CACHE_KEY);
  if (cached) {
    try {
      const data = JSON.parse(cached);
      if (Array.isArray(data) && data.length > 0) {
        results.value = data;
        return true;
      }
    } catch {}
  }
  return false;
};

// 清除缓存
const clearResultsCache = () => {
  localStorage.removeItem(RESULTS_CACHE_KEY);
};

// 加载配置从缓存
const loadConfigFromCache = () => {
  const cached = localStorage.getItem(CONFIG_CACHE_KEY);
  if (cached) {
    try {
      const data = JSON.parse(cached);
      Object.assign(config, data);
    } catch {}
  }
};

// 编辑
const editDialogVisible = ref(false);
const editIndex = ref(null);
const editForm = ref({ question: '', answer: '', type: '', category: '', is_refused: 0 });

// 重新生成回答
const regenerateDialogVisible = ref(false);
const regenerateForm = ref({ index: null, question: '', oldAnswer: '', newAnswer: '' });

// 查看原文
const rawContentDialogVisible = ref(false);
const rawContentQuestion = ref('');
const rawContentText = ref('');

// 确认删除弹窗
const confirmDialogVisible = ref(false);
const confirmDialogText = ref('');
const confirmDialogCallback = ref(null);

const openConfirmDialog = (text, callback) => {
  confirmDialogText.value = text;
  confirmDialogCallback.value = callback;
  confirmDialogVisible.value = true;
};

const handleConfirmDialog = () => {
  confirmDialogVisible.value = false;
  if (confirmDialogCallback.value) {
    confirmDialogCallback.value();
  }
};

// 表格列
const columns = [
  { colKey: 'row-select', type: 'multiple', width: 50 },
  { colKey: 'index', title: '#', width: 50 },
  { colKey: 'question', title: '题目', width: 280, ellipsis: true },
  { colKey: 'answer', title: '回答', width: 200, ellipsis: true, cell: 'answer-preview' },
  { colKey: 'is_refused', title: '是否拒答', width: 90, cell: 'is_refused' },
  { colKey: 'is_duplicate', title: '重复检测', width: 90, cell: 'is_duplicate' },
  { colKey: 'action', title: '操作', width: 340, cell: 'action', fixed: 'right' },
];

// 加载AI配置、技能、类型和类别
const loadConfigsAndSkills = async () => {
  try {
    const [configsRes, skillsRes, promptsRes, typesRes, categoriesRes] = await Promise.all([
      aiConfigAPI.list(),
      aiConfigAPI.getSkills(),
      aiConfigAPI.getPrompts(),
      questionsAPI.getTypes(),
      questionsAPI.getCategories(),
    ]);
    aiConfigs.value = configsRes.data || [];
    skills.value = skillsRes.data || [];
    prompts.value = promptsRes.data || [];
    typeOptions.value = (typesRes.data || []).map(t => ({ label: t, value: t }));
    categoryOptions.value = (categoriesRes.data || []).map(c => ({ label: c, value: c }));

    // 只有在没有选中AI配置时才默认选中第一个
    if (!config.ai_config_id && aiConfigs.value.length > 0) {
      config.ai_config_id = aiConfigs.value[0].id;
    }
  } catch (e) {
    console.error('加载配置失败:', e);
  }
};

// 选择Prompt并追加内容
const handlePromptSelect = (promptId) => {
  if (!promptId) return;
  const prompt = prompts.value.find(p => p.id === promptId);
  if (prompt) {
    const current = config.prompt.trim();
    if (current) {
      config.prompt = current + '\n\n' + prompt.prompt_text;
    } else {
      config.prompt = prompt.prompt_text;
    }
  }
  selectedPromptId.value = null;
};

// 生成
const handleGenerate = async () => {
  if (config.count < 1) {
    MessagePlugin.warning('生成数量至少为1');
    return;
  }

  // 清理之前的 WebSocket 连接
  if (ws) {
    ws.close();
    ws = null;
  }

  // 开始新的生成时清除旧缓存
  clearResultsCache();

  generating.value = true;
  generatingProgress.value = { current: 0, total: config.count };
  results.value = [];

  const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsHost = window.location.host;
  const wsUrl = `${wsProtocol}//${wsHost}/ws/generate`;
  console.log('[WS-Generate] 连接:', wsUrl);
  console.log('[WS-Generate] protocol:', wsProtocol, 'host:', wsHost);

  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    console.log('[WS-Generate] 连接成功');
    const sendData = {
      count: config.count,
      type: config.type,
      category: config.category,
      is_refused: config.is_refused,
      skills: config.skills,
      prompt: config.prompt,
      ai_config_id: config.ai_config_id,
      batch_size: config.batch_size,
      concurrency: config.concurrency,
    };
    lastSentPrompt.value = JSON.stringify(sendData, null, 2);
    ws.send(JSON.stringify(sendData));
  };

  ws.onmessage = (event) => {
    console.log('[WS-Generate] 收到消息:', event.data);
    try {
      const data = JSON.parse(event.data);

      if (data.type === 'progress') {
        generatingProgress.value = { current: data.current, total: data.total };

        const newItem = {
          ...data.item,
          index: results.value.length + 1,
          is_duplicate: false,
        };
        results.value = [...results.value, newItem];
        saveResultsToCache();
      } else if (data.type === 'complete') {
        generating.value = false;
        ws.close();
        ws = null;
        saveResultsToCache();
        MessagePlugin.success(`成功生成${data.total}条`);
      } else if (data.type === 'error') {
        generating.value = false;
        ws.close();
        ws = null;
        MessagePlugin.error(data.message);
      }
    } catch (e) {
      console.error('解析 WebSocket 消息失败:', e);
    }
  };

  ws.onerror = (error) => {
    console.error('WebSocket 错误:', error);
    generating.value = false;
    MessagePlugin.error('WebSocket 连接错误，请检查服务器是否启动');
  };

  ws.onclose = (event) => {
    console.log('[WS-Generate] 连接关闭:', event.code, event.reason);
    generating.value = false;
    generatingProgress.value = { current: 0, total: 0 };
  };
};

// 编辑
const handleEdit = (row) => {
  editIndex.value = row.index - 1;
  editForm.value = {
    question: row.question,
    answer: row.answer,
    type: row.type || config.type,
    category: row.category || config.category,
    is_refused: row.is_refused || 0,
  };
  editDialogVisible.value = true;
};

const handleEditSubmit = async ({ validateResult }) => {
  if (validateResult !== true) return;

  const idx = editIndex.value;
  if (idx !== null && results.value[idx]) {
    results.value[idx] = {
      ...results.value[idx],
      ...editForm.value,
    };
    // 触发响应式更新
    results.value = [...results.value];
  }
  editDialogVisible.value = false;
  MessagePlugin.success('保存成功');
};

// 查看原文
const handleViewRaw = (row) => {
  rawContentQuestion.value = row.question;
  rawContentText.value = row.rawContent || '无原始内容';
  rawContentDialogVisible.value = true;
};

// 重新生成回答
const handleRegenerateAnswer = async (row) => {
  regenerateForm.value = {
    index: row.index - 1,
    question: row.question,
    oldAnswer: row.answer || '',
    newAnswer: '生成中...',
  };
  regenerateDialogVisible.value = true;
  regeneratingAnswer.value[row.index] = true;

  const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${wsProtocol}//${window.location.host}/ws/generate`;
  console.log('[WS-Regenerate] 连接:', wsUrl);

  const regWs = new WebSocket(wsUrl);

  regWs.onopen = () => {
    console.log('[WS-Regenerate] 连接成功');
    regWs.send(JSON.stringify({
      count: 1,
      type: row.type || config.type,
      category: row.category || config.category,
      is_refused: row.is_refused,
      skills: config.skills,
      prompt: `针对以下题目，生成一个简短、专业的回答（只需要回答，不需要重复题目）：\n\n${row.question}`,
      ai_config_id: config.ai_config_id,
    }));
  };

  regWs.onmessage = (event) => {
    console.log('[WS-Regenerate] 收到消息:', event.data);
    try {
      const data = JSON.parse(event.data);
      if (data.type === 'progress') {
        regenerateForm.value.newAnswer = data.item.answer || data.item.response || '生成内容为空';
      } else if (data.type === 'complete') {
        regWs.close();
        regeneratingAnswer.value[row.index] = false;
      } else if (data.type === 'error') {
        regenerateForm.value.newAnswer = `错误: ${data.message}`;
        regWs.close();
        regeneratingAnswer.value[row.index] = false;
      }
    } catch (e) {
      console.error('解析消息失败:', e);
    }
  };

  regWs.onerror = (error) => {
    console.error('[WS-Regenerate] 错误:', error);
    regenerateForm.value.newAnswer = 'WebSocket连接错误，请检查服务器是否启动';
    regeneratingAnswer.value[row.index] = false;
  };

  regWs.onclose = (event) => {
    console.log('[WS-Regenerate] 连接关闭:', event.code, event.reason);
  };
};

// 使用新回答
const handleUseNewAnswer = () => {
  const idx = regenerateForm.value.index;
  if (idx !== null && results.value[idx] && regenerateForm.value.newAnswer && !regenerateForm.value.newAnswer.startsWith('错误') && !regenerateForm.value.newAnswer.startsWith('WebSocket')) {
    results.value[idx].answer = regenerateForm.value.newAnswer;
    results.value = [...results.value];
    regenerateDialogVisible.value = false;
    MessagePlugin.success('已使用新回答');
  } else if (regenerateForm.value.newAnswer.startsWith('错误') || regenerateForm.value.newAnswer.startsWith('WebSocket')) {
    MessagePlugin.error('生成失败，无法使用');
  }
};

// 删除
const handleDelete = (row) => {
  openConfirmDialog('确定删除该条记录吗？', () => {
    const idx = results.value.findIndex(r => r.index === row.index);
    if (idx > -1) {
      results.value.splice(idx, 1);
      results.value.forEach((r, i) => r.index = i + 1);
      results.value = [...results.value];
      saveResultsToCache();
    }
    MessagePlugin.success('删除成功');
  });
};

// 批量删除
const handleBatchDelete = () => {
  openConfirmDialog(`确定删除选中的 ${selectedRows.value.length} 条记录吗？`, () => {
    results.value = results.value.filter(r => !selectedRows.value.includes(r.index));
    results.value.forEach((r, i) => r.index = i + 1);
    results.value = [...results.value];
    selectedRows.value = [];
    saveResultsToCache();
    MessagePlugin.success('删除成功');
  });
};

// 添加到测试集
const handleAddToTestSet = async (row) => {
  try {
    await aiGenerateAPI.save({ items: [row] });
    MessagePlugin.success('已添加到测试集');
    // 从结果列表移除
    const idx = results.value.findIndex(r => r.index === row.index);
    if (idx > -1) {
      results.value.splice(idx, 1);
      results.value.forEach((r, i) => r.index = i + 1);
      results.value = [...results.value];
      saveResultsToCache();
    }
  } catch (e) {
    MessagePlugin.error(e?.response?.data?.message || '添加失败');
  }
};

// 批量添加到测试集
const handleBatchAdd = async () => {
  const selectedItems = results.value.filter(r => selectedRows.value.includes(r.index));
  if (!selectedItems.length) {
    MessagePlugin.warning('请选择要添加的记录');
    return;
  }
  try {
    await aiGenerateAPI.save({ items: selectedItems });
    MessagePlugin.success(`成功添加 ${selectedItems.length} 条到测试集`);
    // 从结果列表移除已添加的项
    results.value = results.value.filter(r => !selectedRows.value.includes(r.index));
    results.value.forEach((r, i) => r.index = i + 1);
    results.value = [...results.value];
    selectedRows.value = [];
    saveResultsToCache();
  } catch (e) {
    MessagePlugin.error(e?.response?.data?.message || '添加失败');
  }
};

// 重复检测
const handleCheckDuplicates = async () => {
  if (results.value.length < 1) {
    MessagePlugin.info('至少需要1条记录才能检测重复');
    return;
  }
  checkingDuplicate.value = true;
  try {
    const questions = results.value.map(r => r.question);
    const res = await aiGenerateAPI.checkDuplicate({ questions });
    const data = res.data || {};

    const externalDuplicates = data.external_duplicates || [];
    const internalDuplicates = data.internal_duplicates || [];

    // 重置所有重复标记
    results.value.forEach(r => {
      r.is_duplicate = false;
      r.duplicate_with = null;
      r.checked = true;
    });

    // 标记与已有题目的重复
    externalDuplicates.forEach(d => {
      if (results.value[d.index]) {
        results.value[d.index].is_duplicate = true;
        results.value[d.index].duplicate_with = `已有题目(ID:${d.existing_id})`;
      }
    });

    // 标记内部重复
    internalDuplicates.forEach(d => {
      if (results.value[d.index1]) results.value[d.index1].is_duplicate = true;
      if (results.value[d.index2]) results.value[d.index2].is_duplicate = true;
    });

    results.value = [...results.value];

    const totalExternal = data.total_external || 0;
    const totalInternal = data.total_internal || 0;

    if (totalExternal > 0 || totalInternal > 0) {
      let msg = `检测到 ${totalExternal} 条与已有题目重复`;
      if (totalInternal > 0) {
        msg += `，${totalInternal} 组内部重复`;
      }
      MessagePlugin.warning(msg);
    } else {
      MessagePlugin.success('未检测到重复');
    }
  } catch (e) {
    MessagePlugin.error('重复检测失败');
  } finally {
    checkingDuplicate.value = false;
  }
};

// 删除重复记录（带确认）
const handleDeleteDuplicates = () => {
  const duplicates = results.value.filter(r => r.is_duplicate);
  if (duplicates.length === 0) {
    MessagePlugin.info('没有需要删除的重复记录');
    return;
  }

  openConfirmDialog(`确定删除 ${duplicates.length} 条重复记录吗？`, () => {
    results.value = results.value.filter(r => !r.is_duplicate);
    results.value.forEach((r, i) => r.index = i + 1);
    results.value = [...results.value];
    selectedRows.value = [];
    saveResultsToCache();
    MessagePlugin.success(`已删除 ${duplicates.length} 条重复记录`);
  });
};

// 选择
const handleSelectChange = (value) => {
  selectedRows.value = value;
};

onMounted(async () => {
  // 先加载缓存中的配置
  loadConfigFromCache();
  // 加载配置列表（缓存已有配置时不会覆盖）
  await loadConfigsAndSkills();
  // 加载生成结果
  loadResultsFromCache();
});

// 监听配置变化，自动保存到缓存
watch(config, () => {
  localStorage.setItem(CONFIG_CACHE_KEY, JSON.stringify(config));
}, { deep: true });
</script>

<style scoped>
.page {
  background: #fff;
  padding: 20px 24px;
  border-radius: 8px;
  height: 100%;
  overflow: hidden;
}

.layout {
  display: flex;
  gap: 20px;
  height: 100%;
}

.config-panel {
  width: 360px;
  flex-shrink: 0;
  background: #fafafa;
  border-radius: 8px;
  padding: 20px;
  overflow-y: auto;
}

.result-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
}

.panel-title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.result-count {
  font-size: 13px;
  color: #888;
  font-weight: normal;
}

.toolbar {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
  flex-shrink: 0;
}

.table-wrapper {
  flex: 1;
  overflow: auto;
  min-height: 0;
}

.table-wrapper :deep(.t-table) {
  max-height: 100%;
}

.prompt-wrapper {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.prompt-selector {
  margin-top: 4px;
}

.form-tip {
  font-size: 12px;
  color: #888;
  margin-top: 4px;
}

.ai-section {
  background: #f5f5f5;
  padding: 12px;
  border-radius: 6px;
}

.ai-answer-box {
  background: #fff;
  border: 1px solid #e8e8e8;
  border-radius: 4px;
  padding: 12px;
  max-height: 150px;
  overflow-y: auto;
  white-space: pre-wrap;
  font-size: 13px;
  line-height: 1.6;
}

.ai-answer-box.ai-answer-new {
  border-color: #0052d9;
  background: #f0f5ff;
}

.raw-content-box {
  background: #1e1e1e;
  color: #d4d4d4;
  border-radius: 4px;
  padding: 12px;
  max-height: 400px;
  overflow-y: auto;
  white-space: pre-wrap;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 12px;
  line-height: 1.5;
}

.last-prompt {
  margin-top: 12px;
  padding: 10px;
  background: #f0f5ff;
  border: 1px solid #d9e8ff;
  border-radius: 6px;
  font-size: 12px;
}

.last-prompt-label {
  color: #0052d9;
  font-weight: 500;
  margin-bottom: 6px;
}

.last-prompt-content {
  color: #666;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 100px;
  overflow-y: auto;
  line-height: 1.5;
}
</style>