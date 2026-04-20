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
            <t-input v-model="config.type" placeholder="如：文本生成、图像生成" />
          </t-form-item>

          <t-form-item label="类别">
            <t-input v-model="config.category" placeholder="请输入类别" />
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
            <t-input-number v-model="config.count" :min="1" :max="20" :step="1" />
          </t-form-item>

          <t-form-item>
            <t-button theme="primary" :loading="generating" @click="handleGenerate">
              <template #icon><t-icon name="chat" /></template>
              生成题目
            </t-button>
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
              <t-tag v-if="row.is_duplicate" theme="warning" variant="light">重复</t-tag>
              <span v-else style="color: #bbb">-</span>
            </template>
            <template #action="{ row }">
              <t-button variant="text" size="small" theme="primary" @click="handleEdit(row)">编辑</t-button>
              <t-button variant="text" size="small" theme="danger" @click="handleDelete(row)">删除</t-button>
              <t-button variant="text" size="small" theme="success" @click="handleAddToTestSet(row)">添加到测试集</t-button>
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
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { MessagePlugin, DialogPlugin } from 'tdesign-vue-next';
import { aiConfigAPI, aiGenerateAPI } from '@/api';

const aiConfigs = ref([]);
const skills = ref([]);
const prompts = ref([]);
const selectedPromptId = ref(null);

// 配置
const config = reactive({
  ai_config_id: null,
  type: '',
  category: '',
  is_refused: null,
  skills: [],
  prompt: '',
  count: 5,
});

// 生成结果
const results = ref([]);
const generating = ref(false);
const selectedRows = ref([]);
const checkingDuplicate = ref(false);

// 编辑
const editDialogVisible = ref(false);
const editIndex = ref(null);
const editForm = ref({ question: '', answer: '', type: '', category: '', is_refused: 0 });

// 表格列
const columns = [
  { colKey: 'row-select', type: 'multiple', width: 50 },
  { colKey: 'index', title: '#', width: 50 },
  { colKey: 'question', title: '题目', width: 280, ellipsis: true },
  { colKey: 'answer', title: '回答', width: 200, ellipsis: true },
  { colKey: 'is_refused', title: '是否拒答', width: 90, cell: 'is_refused' },
  { colKey: 'is_duplicate', title: '重复检测', width: 90, cell: 'is_duplicate' },
  { colKey: 'action', title: '操作', width: 240, cell: 'action', fixed: 'right' },
];

// 加载AI配置和技能
const loadConfigsAndSkills = async () => {
  try {
    const [configsRes, skillsRes, promptsRes] = await Promise.all([
      aiConfigAPI.list(),
      aiConfigAPI.getSkills(),
      aiConfigAPI.getPrompts(),
    ]);
    aiConfigs.value = configsRes.data || [];
    skills.value = skillsRes.data || [];
    prompts.value = promptsRes.data || [];

    // 默认选中第一个AI配置
    if (aiConfigs.value.length > 0) {
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
  generating.value = true;
  try {
    const res = await aiGenerateAPI.generate({
      count: config.count,
      type: config.type,
      category: config.category,
      is_refused: config.is_refused,
      skills: config.skills,
      prompt: config.prompt,
      ai_config_id: config.ai_config_id,
    });

    const newResults = res.data.map((item, idx) => ({
      ...item,
      index: results.value.length + idx + 1,
      is_duplicate: false,
    }));

    results.value = [...results.value, ...newResults];
    MessagePlugin.success(res.message || '生成成功');
  } catch (e) {
    const errMsg = e?.response?.data?.message || e?.message || '生成失败';
    MessagePlugin.error(errMsg);
  } finally {
    generating.value = false;
  }
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

// 删除
const handleDelete = (row) => {
  const idx = results.value.findIndex(r => r.index === row.index);
  if (idx > -1) {
    results.value.splice(idx, 1);
    // 重新编号
    results.value.forEach((r, i) => r.index = i + 1);
    results.value = [...results.value];
  }
};

// 批量删除
const handleBatchDelete = () => {
  const dialog = DialogPlugin.confirm({
    header: '确认删除',
    body: `确定删除选中的 ${selectedRows.value.length} 条记录吗？`,
    theme: 'warning',
    confirmBtn: { content: '确认', theme: 'danger' },
    onConfirm: () => {
      results.value = results.value.filter(r => !selectedRows.value.includes(r.index));
      results.value.forEach((r, i) => r.index = i + 1);
      results.value = [...results.value];
      selectedRows.value = [];
      dialog.destroy();
      MessagePlugin.success('删除成功');
    },
    onClose: () => dialog.destroy(),
  });
};

// 添加到测试集
const handleAddToTestSet = async (row) => {
  try {
    await aiGenerateAPI.save({ items: [row] });
    MessagePlugin.success('已添加到测试集');
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
    selectedRows.value = [];
  } catch (e) {
    MessagePlugin.error(e?.response?.data?.message || '添加失败');
  }
};

// 重复检测
const handleCheckDuplicates = async () => {
  if (results.value.length < 2) {
    MessagePlugin.info('至少需要2条记录才能检测重复');
    return;
  }
  checkingDuplicate.value = true;
  try {
    const questions = results.value.map(r => r.question);
    const res = await aiGenerateAPI.checkDuplicate({ questions });
    const duplicates = res.data || [];

    // 重置所有重复标记
    results.value.forEach(r => r.is_duplicate = false);

    // 标记重复项
    duplicates.forEach(d => {
      if (results.value[d.index1]) results.value[d.index1].is_duplicate = true;
      if (results.value[d.index2]) results.value[d.index2].is_duplicate = true;
    });

    results.value = [...results.value];

    if (duplicates.length) {
      MessagePlugin.warning(`检测到 ${duplicates.length} 组重复`);
    } else {
      MessagePlugin.success('未检测到重复');
    }
  } catch (e) {
    MessagePlugin.error('重复检测失败');
  } finally {
    checkingDuplicate.value = false;
  }
};

// 选择
const handleSelectChange = (value) => {
  selectedRows.value = value;
};

onMounted(() => {
  loadConfigsAndSkills();
});
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
  overflow: hidden;
  min-height: 0;
}

.table-wrapper :deep(.t-table) {
  height: 100%;
}

.prompt-wrapper {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.prompt-selector {
  margin-top: 4px;
}
</style>