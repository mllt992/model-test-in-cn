<template>
  <div class="page">
    <h2 class="page-title">系统设置</h2>

    <t-tabs v-model="activeTab">
      <!-- AI配置 -->
      <t-tab-panel value="basic" label="AI配置">
        <div class="toolbar">
          <t-button theme="primary" @click="showAddConfigDialog">
            <template #icon><t-icon name="add" /></template>
            新增配置
          </t-button>
        </div>

        <t-table :data="configs" :columns="configColumns" row-key="id" hover stripe>
          <template #is_active="{ row }">
            <t-tag :theme="row.is_active ? 'success' : 'default'">{{ row.is_active ? '已激活' : '未激活' }}</t-tag>
          </template>
          <template #action="{ row }">
            <t-link theme="primary" hover="color" @click="handleActivateConfig(row)" :disabled="!!row.is_active">激活</t-link>
            <t-link theme="primary" hover="color" @click="handleEditConfig(row)" style="margin-left: 8px">编辑</t-link>
            <t-link theme="primary" hover="color" @click="handleCopyConfig(row)" style="margin-left: 8px">复制</t-link>
            <t-link theme="danger" hover="color" @click="handleDeleteConfig(row)" style="margin-left: 8px">删除</t-link>
          </template>
        </t-table>

        <!-- 新增/编辑配置弹窗 -->
        <t-dialog v-model:visible="configDialogVisible" :header="isEditConfig ? '编辑配置' : '新增配置'" :footer="false" width="680px">
          <t-form :data="configForm" @submit="handleConfigSubmit" label-width="100px">
            <t-form-item label="名称" name="name">
              <t-input v-model="configForm.name" placeholder="请输入配置名称" />
            </t-form-item>
            <t-form-item label="协议" name="protocol">
              <t-select v-model="configForm.protocol">
                <t-option value="openai" label="OpenAI" />
                <t-option value="codex" label="Codex" />
                <t-option value="claude" label="Claude" />
                <t-option value="gemini" label="Gemini" />
              </t-select>
            </t-form-item>
            <t-form-item label="API地址" name="api_base_url">
              <t-input v-model="configForm.api_base_url" placeholder="如 https://api.openai.com/v1" />
            </t-form-item>
            <t-form-item label="API密钥" name="api_key">
              <t-input v-model="configForm.api_key" type="password" placeholder="请输入API Key" />
            </t-form-item>
            <t-form-item label="模型" name="model">
              <div class="model-select">
                <t-select
                  v-model="configForm.model"
                  :options="modelOptions"
                  :loading="loadingModels"
                  filterable
                  creatable
                  placeholder="输入或选择模型"
                  style="flex: 1"
                />
                <t-button variant="outline" :loading="loadingModels" @click="fetchModels">
                  <template #icon><t-icon name="refresh" /></template>
                  刷新
                </t-button>
              </div>
            </t-form-item>
            <t-form-item label="Agent设定" name="agent_prompt">
              <t-textarea v-model="configForm.agent_prompt" placeholder="请输入Agent设定" :autosize="{ minRows: 4, maxRows: 12 }" />
            </t-form-item>
            <t-form-item label="规则设定" name="rules">
              <t-textarea v-model="configForm.rules" placeholder="请输入规则设定" :autosize="{ minRows: 4, maxRows: 12 }" />
            </t-form-item>
            <t-form-item>
              <t-space>
                <t-button type="submit" theme="primary">{{ isEditConfig ? '保存' : '新增' }}</t-button>
                <t-button variant="outline" @click="testConnection" :loading="testing">测试连接</t-button>
                <t-button variant="outline" @click="configDialogVisible = false">取消</t-button>
              </t-space>
            </t-form-item>
          </t-form>
        </t-dialog>
      </t-tab-panel>

      <!-- Skill 管理 -->
      <t-tab-panel value="skills" label="Skill管理">
        <div class="toolbar">
          <t-button theme="primary" @click="showAddSkillDialog">
            <template #icon><t-icon name="add" /></template>
            新增
          </t-button>
        </div>

        <t-table :data="skills" :columns="skillColumns" row-key="id" hover stripe>
          <template #enabled="{ row }">
            <t-switch :value="row.enabled === 1" @change="(val) => toggleSkill(row, val)" />
          </template>
          <template #action="{ row }">
            <t-link theme="primary" hover="color" @click="handleEditSkill(row)">编辑</t-link>
            <t-link theme="danger" hover="color" @click="handleDeleteSkill(row)" style="margin-left: 8px">删除</t-link>
          </template>
        </t-table>

        <!-- 新增/编辑技能弹窗 -->
        <t-dialog v-model:visible="skillDialogVisible" :header="isEditSkill ? '编辑技能' : '新增技能'" :footer="false" width="600px">
          <t-form :data="skillForm" @submit="handleSkillSubmit" label-width="80px">
            <t-form-item label="名称" name="name">
              <t-input v-model="skillForm.name" placeholder="请输入技能名称" />
            </t-form-item>
            <t-form-item label="描述" name="description">
              <t-input v-model="skillForm.description" placeholder="请输入技能描述" />
            </t-form-item>
            <t-form-item label="内容" name="content">
              <t-textarea v-model="skillForm.content" placeholder="请输入技能内容" :autosize="{ minRows: 6, maxRows: 20 }" />
            </t-form-item>
            <t-form-item label="排序" name="sort_order">
              <t-input-number v-model="skillForm.sort_order" :min="0" />
            </t-form-item>
            <t-form-item>
              <t-button type="submit" theme="primary">{{ isEditSkill ? '保存' : '新增' }}</t-button>
              <t-button variant="outline" @click="skillDialogVisible = false" style="margin-left: 12px">取消</t-button>
            </t-form-item>
          </t-form>
        </t-dialog>
      </t-tab-panel>

      <!-- Prompt 管理 -->
      <t-tab-panel value="prompts" label="Prompt管理">
        <div class="toolbar">
          <t-button theme="primary" @click="showAddPromptDialog">
            <template #icon><t-icon name="add" /></template>
            新增
          </t-button>
        </div>

        <t-table :data="prompts" :columns="promptColumns" row-key="id" hover stripe>
          <template #enabled="{ row }">
            <t-switch :value="row.enabled === 1" @change="(val) => togglePrompt(row, val)" />
          </template>
          <template #prompt_text="{ row }">
            <span :title="row.prompt_text">{{ row.prompt_text.length > 60 ? row.prompt_text.slice(0, 60) + '...' : row.prompt_text }}</span>
          </template>
          <template #action="{ row }">
            <t-link theme="primary" hover="color" @click="handleEditPrompt(row)">编辑</t-link>
            <t-link theme="danger" hover="color" @click="handleDeletePrompt(row)" style="margin-left: 8px">删除</t-link>
          </template>
        </t-table>

        <!-- 新增/编辑Prompt弹窗 -->
        <t-dialog v-model:visible="promptDialogVisible" :header="isEditPrompt ? '编辑Prompt' : '新增Prompt'" :footer="false" width="680px">
          <t-form :data="promptForm" @submit="handlePromptSubmit" label-width="80px">
            <t-form-item label="名称" name="name">
              <t-input v-model="promptForm.name" placeholder="请输入Prompt名称" />
            </t-form-item>
            <t-form-item label="分类" name="category">
              <t-select v-model="promptForm.category" clearable filterable creatable placeholder="请选择或输入分类" style="width: 100%">
                <t-option v-for="cat in promptCategories" :key="cat" :value="cat" :label="cat" />
              </t-select>
            </t-form-item>
            <t-form-item label="描述" name="description">
              <t-input v-model="promptForm.description" placeholder="请输入Prompt描述" />
            </t-form-item>
            <t-form-item label="内容" name="prompt_text">
              <t-textarea v-model="promptForm.prompt_text" placeholder="请输入Prompt内容" :autosize="{ minRows: 6, maxRows: 16 }" />
            </t-form-item>
            <t-form-item label="排序" name="sort_order">
              <t-input-number v-model="promptForm.sort_order" :min="0" />
            </t-form-item>
            <t-form-item>
              <t-button type="submit" theme="primary">{{ isEditPrompt ? '保存' : '新增' }}</t-button>
              <t-button variant="outline" @click="promptDialogVisible = false" style="margin-left: 12px">取消</t-button>
            </t-form-item>
          </t-form>
        </t-dialog>
      </t-tab-panel>
    </t-tabs>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { MessagePlugin, DialogPlugin } from 'tdesign-vue-next';
import { aiConfigAPI } from '@/api';

const activeTab = ref('basic');

// ====== AI 配置列表 ======
const configs = ref([]);
const configDialogVisible = ref(false);
const isEditConfig = ref(false);
const editConfigId = ref(null);
const configForm = ref({
  name: '',
  api_base_url: '',
  api_key: '',
  protocol: 'openai',
  model: '',
  agent_prompt: '',
  rules: '',
});
const modelOptions = ref([]);
const testing = ref(false);
const loadingModels = ref(false);

const configColumns = [
  { colKey: 'id', title: 'ID', width: 60 },
  { colKey: 'name', title: '名称', width: 140 },
  { colKey: 'protocol', title: '协议', width: 90 },
  { colKey: 'api_base_url', title: 'API地址', ellipsis: true },
  { colKey: 'model', title: '模型', width: 160, ellipsis: true },
  { colKey: 'is_active', title: '状态', width: 90, cell: 'is_active' },
  { colKey: 'updated_at', title: '更新时间', width: 170 },
  { colKey: 'action', title: '操作', width: 220, cell: 'action', fixed: 'right' },
];

const CONFIG_CACHE_KEY = 'ai_config_cache';
const SKILLS_CACHE_KEY = 'ai_skills_cache';
const PROMPTS_CACHE_KEY = 'ai_prompts_cache';

const loadConfigs = async () => {
  try {
    const res = await aiConfigAPI.list();
    configs.value = res.data || [];
    // 缓存到本地
    localStorage.setItem(CONFIG_CACHE_KEY, JSON.stringify(configs.value));
  } catch {
    // 加载失败时尝试从缓存读取
    const cached = localStorage.getItem(CONFIG_CACHE_KEY);
    if (cached) {
      try {
        configs.value = JSON.parse(cached);
      } catch {}
    }
  }
};

const showAddConfigDialog = () => {
  isEditConfig.value = false;
  editConfigId.value = null;
  configForm.value = { name: '', api_base_url: '', api_key: '', protocol: 'openai', model: '', agent_prompt: '', rules: '' };
  modelOptions.value = [];
  configDialogVisible.value = true;
};

const handleEditConfig = (row) => {
  isEditConfig.value = true;
  editConfigId.value = row.id;
  configForm.value = {
    name: row.name || '',
    api_base_url: row.api_base_url || '',
    api_key: row.api_key || '',
    protocol: row.protocol || 'openai',
    model: row.model || '',
    agent_prompt: row.agent_prompt || '',
    rules: row.rules || '',
  };
  if (row.model) {
    modelOptions.value = [{ label: row.model, value: row.model }];
  }
  configDialogVisible.value = true;
};

const handleConfigSubmit = async ({ validateResult }) => {
  if (validateResult !== true) return;
  try {
    if (isEditConfig.value) {
      await aiConfigAPI.update(editConfigId.value, configForm.value);
      MessagePlugin.success('更新成功');
    } else {
      await aiConfigAPI.create(configForm.value);
      MessagePlugin.success('新增成功');
    }
    configDialogVisible.value = false;
    loadConfigs();
  } catch {}
};

const handleActivateConfig = async (row) => {
  if (row.is_active) return;
  try {
    await aiConfigAPI.activate(row.id);
    MessagePlugin.success('已激活');
    loadConfigs();
  } catch {}
};

const handleCopyConfig = async (row) => {
  try {
    await aiConfigAPI.create({
      name: `${row.name} (副本)`,
      api_base_url: row.api_base_url,
      api_key: row.api_key,
      protocol: row.protocol,
      model: row.model,
      agent_prompt: row.agent_prompt,
      rules: row.rules,
    });
    MessagePlugin.success('复制成功');
    loadConfigs();
  } catch {}
};

const handleDeleteConfig = (row) => {
  const dialog = DialogPlugin.confirm({
    header: '确认删除',
    body: `确定删除配置"${row.name}"吗？`,
    theme: 'warning',
    confirmBtn: { content: '确认', theme: 'danger' },
    onConfirm: async () => {
      dialog.destroy();
      try {
        await aiConfigAPI.delete(row.id);
        MessagePlugin.success('删除成功');
        loadConfigs();
      } catch {}
    },
    onCancel: () => {
      dialog.destroy();
    },
  });
};

const testConnection = async () => {
  if (!configForm.value.api_base_url) {
    MessagePlugin.warning('请先填写API地址');
    return;
  }
  testing.value = true;
  try {
    await aiConfigAPI.testConnection({
      api_base_url: configForm.value.api_base_url,
      api_key: configForm.value.api_key,
      protocol: configForm.value.protocol,
    });
    MessagePlugin.success('连接成功');
  } catch {} finally {
    testing.value = false;
  }
};

const fetchModels = async () => {
  if (!configForm.value.api_base_url || !configForm.value.api_key) {
    MessagePlugin.warning('请先填写API地址和密钥');
    return;
  }
  loadingModels.value = true;
  try {
    const res = await aiConfigAPI.fetchModels({
      api_base_url: configForm.value.api_base_url,
      api_key: configForm.value.api_key,
      protocol: configForm.value.protocol,
    });
    modelOptions.value = (res.data || []).map((m) => ({ label: m, value: m }));
    if (!res.data || res.data.length === 0) {
      MessagePlugin.info('未获取到模型列表，可手动输入模型名称');
    }
  } catch {} finally {
    loadingModels.value = false;
  }
};

// ====== Skill 管理 ======
const skills = ref([]);
const skillDialogVisible = ref(false);
const isEditSkill = ref(false);
const editSkillId = ref(null);
const skillForm = ref({ name: '', description: '', content: '', enabled: 1, sort_order: 0 });

const skillColumns = [
  { colKey: 'id', title: 'ID', width: 60 },
  { colKey: 'name', title: '名称', width: 160 },
  { colKey: 'description', title: '描述', ellipsis: true },
  { colKey: 'enabled', title: '启用', width: 80, cell: 'enabled' },
  { colKey: 'sort_order', title: '排序', width: 80 },
  { colKey: 'updated_at', title: '更新时间', width: 170 },
  { colKey: 'action', title: '操作', width: 130, cell: 'action', fixed: 'right' },
];

const loadSkills = async () => {
  try {
    const res = await aiConfigAPI.getSkills();
    skills.value = res.data || [];
    localStorage.setItem(SKILLS_CACHE_KEY, JSON.stringify(skills.value));
  } catch {
    const cached = localStorage.getItem(SKILLS_CACHE_KEY);
    if (cached) {
      try {
        skills.value = JSON.parse(cached);
      } catch {}
    }
  }
};

const showAddSkillDialog = () => {
  isEditSkill.value = false;
  editSkillId.value = null;
  skillForm.value = { name: '', description: '', content: '', enabled: 1, sort_order: 0 };
  skillDialogVisible.value = true;
};

const handleEditSkill = (row) => {
  isEditSkill.value = true;
  editSkillId.value = row.id;
  skillForm.value = { name: row.name, description: row.description, content: row.content, enabled: row.enabled, sort_order: row.sort_order };
  skillDialogVisible.value = true;
};

const handleSkillSubmit = async ({ validateResult }) => {
  if (validateResult !== true) return;
  try {
    if (isEditSkill.value) {
      await aiConfigAPI.updateSkill(editSkillId.value, skillForm.value);
      MessagePlugin.success('更新成功');
    } else {
      await aiConfigAPI.createSkill(skillForm.value);
      MessagePlugin.success('新增成功');
    }
    skillDialogVisible.value = false;
    loadSkills();
  } catch {}
};

const handleDeleteSkill = (row) => {
  const dialog = DialogPlugin.confirm({
    header: '确认删除',
    body: `确定删除技能"${row.name}"吗？`,
    theme: 'warning',
    confirmBtn: { content: '确认', theme: 'danger' },
    onConfirm: async () => {
      dialog.destroy();
      try {
        await aiConfigAPI.deleteSkill(row.id);
        MessagePlugin.success('删除成功');
        loadSkills();
      } catch {}
    },
    onCancel: () => {
      dialog.destroy();
    },
  });
};

const toggleSkill = async (row, val) => {
  try {
    await aiConfigAPI.updateSkill(row.id, { enabled: val ? 1 : 0 });
    loadSkills();
  } catch {}
};

// ====== Prompt 管理 ======
const prompts = ref([]);
const promptDialogVisible = ref(false);
const isEditPrompt = ref(false);
const editPromptId = ref(null);
const promptCategories = ref(['通用', '问答', '生成', '分析', '转换']);
const promptForm = ref({ name: '', prompt_text: '', description: '', category: '', enabled: 1, sort_order: 0 });

const promptColumns = [
  { colKey: 'id', title: 'ID', width: 60 },
  { colKey: 'name', title: '名称', width: 160 },
  { colKey: 'category', title: '分类', width: 100 },
  { colKey: 'description', title: '描述', ellipsis: true },
  { colKey: 'prompt_text', title: '内容', ellipsis: true, cell: 'prompt_text' },
  { colKey: 'enabled', title: '启用', width: 80, cell: 'enabled' },
  { colKey: 'sort_order', title: '排序', width: 80 },
  { colKey: 'updated_at', title: '更新时间', width: 170 },
  { colKey: 'action', title: '操作', width: 130, cell: 'action', fixed: 'right' },
];

const loadPrompts = async () => {
  try {
    const res = await aiConfigAPI.getPrompts();
    prompts.value = res.data || [];
    localStorage.setItem(PROMPTS_CACHE_KEY, JSON.stringify(prompts.value));
  } catch {
    const cached = localStorage.getItem(PROMPTS_CACHE_KEY);
    if (cached) {
      try {
        prompts.value = JSON.parse(cached);
      } catch {}
    }
  }
};

const showAddPromptDialog = () => {
  isEditPrompt.value = false;
  editPromptId.value = null;
  promptForm.value = { name: '', prompt_text: '', description: '', category: '', enabled: 1, sort_order: 0 };
  promptDialogVisible.value = true;
};

const handleEditPrompt = (row) => {
  isEditPrompt.value = true;
  editPromptId.value = row.id;
  promptForm.value = { name: row.name, prompt_text: row.prompt_text, description: row.description || '', category: row.category || '', enabled: row.enabled, sort_order: row.sort_order };
  promptDialogVisible.value = true;
};

const handlePromptSubmit = async ({ validateResult }) => {
  if (validateResult !== true) return;
  try {
    if (isEditPrompt.value) {
      await aiConfigAPI.updatePrompt(editPromptId.value, promptForm.value);
      MessagePlugin.success('更新成功');
    } else {
      await aiConfigAPI.createPrompt(promptForm.value);
      MessagePlugin.success('新增成功');
    }
    promptDialogVisible.value = false;
    loadPrompts();
  } catch {}
};

const handleDeletePrompt = (row) => {
  const dialog = DialogPlugin.confirm({
    header: '确认删除',
    body: `确定删除Prompt"${row.name}"吗？`,
    theme: 'warning',
    confirmBtn: { content: '确认', theme: 'danger' },
    onConfirm: async () => {
      dialog.destroy();
      try {
        await aiConfigAPI.deletePrompt(row.id);
        MessagePlugin.success('删除成功');
        loadPrompts();
      } catch {}
    },
    onCancel: () => {
      dialog.destroy();
    },
  });
};

const togglePrompt = async (row, val) => {
  try {
    await aiConfigAPI.updatePrompt(row.id, { enabled: val ? 1 : 0 });
    loadPrompts();
  } catch {}
};

onMounted(() => {
  loadConfigs();
  loadSkills();
  loadPrompts();
});
</script>

<style scoped>
.page {
  background: #fff;
  padding: 20px 24px;
  border-radius: 8px;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.page-title { font-size: 18px; font-weight: 600; margin-bottom: 16px; flex-shrink: 0; }
.model-select { display: flex; gap: 8px; width: 100%; }
.toolbar { display: flex; gap: 8px; margin-bottom: 12px; margin-top: 12px; flex-shrink: 0; }
</style>
