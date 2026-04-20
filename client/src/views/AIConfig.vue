<template>
  <div class="page">
    <h2 class="page-title">系统设置</h2>

    <t-tabs v-model="activeTab">
      <!-- 基本配置 -->
      <t-tab-panel value="basic" label="AI配置">
        <t-form :data="config" label-width="100px" class="config-form">
          <t-form-item label="协议" name="protocol">
            <t-select v-model="config.protocol">
              <t-option value="openai" label="OpenAI" />
              <t-option value="codex" label="Codex" />
              <t-option value="claude" label="Claude" />
              <t-option value="gemini" label="Gemini" />
            </t-select>
          </t-form-item>
          <t-form-item label="API地址" name="api_base_url">
            <t-input v-model="config.api_base_url" placeholder="如 https://api.openai.com/v1" />
          </t-form-item>
          <t-form-item label="API密钥" name="api_key">
            <t-input v-model="config.api_key" type="password" placeholder="请输入API Key" />
          </t-form-item>
          <t-form-item label="模型" name="model">
            <div class="model-select">
              <t-select
                v-model="config.model"
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
            <t-textarea v-model="config.agent_prompt" placeholder="请输入Agent设定" :autosize="{ minRows: 4, maxRows: 12 }" />
          </t-form-item>
          <t-form-item label="规则设定" name="rules">
            <t-textarea v-model="config.rules" placeholder="请输入规则设定" :autosize="{ minRows: 4, maxRows: 12 }" />
          </t-form-item>
          <t-form-item>
            <t-space>
              <t-button theme="primary" @click="saveConfig" :loading="saving">保存配置</t-button>
              <t-button variant="outline" @click="testConnection" :loading="testing">测试连接</t-button>
            </t-space>
          </t-form-item>
        </t-form>
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
    </t-tabs>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { MessagePlugin, DialogPlugin } from 'tdesign-vue-next';
import { aiConfigAPI } from '@/api';

const activeTab = ref('basic');

// ====== AI 配置 ======
const config = ref({
  id: null,
  api_base_url: '',
  api_key: '',
  protocol: 'openai',
  model: '',
  agent_prompt: '',
  rules: '',
});
const modelOptions = ref([]);
const saving = ref(false);
const testing = ref(false);
const loadingModels = ref(false);

const loadConfig = async () => {
  try {
    const res = await aiConfigAPI.getActive();
    if (res.data) {
      config.value = { ...config.value, ...res.data };
      if (res.data.model) {
        modelOptions.value = [{ label: res.data.model, value: res.data.model }];
      }
    }
  } catch {}
};

const saveConfig = async () => {
  saving.value = true;
  try {
    await aiConfigAPI.save({ ...config.value });
    MessagePlugin.success('保存成功');
    loadConfig();
  } catch {} finally {
    saving.value = false;
  }
};

const testConnection = async () => {
  if (!config.value.api_base_url) {
    MessagePlugin.warning('请先填写API地址');
    return;
  }
  testing.value = true;
  try {
    await aiConfigAPI.testConnection({
      api_base_url: config.value.api_base_url,
      api_key: config.value.api_key,
      protocol: config.value.protocol,
    });
    MessagePlugin.success('连接成功');
  } catch {} finally {
    testing.value = false;
  }
};

const fetchModels = async () => {
  if (!config.value.api_base_url || !config.value.api_key) {
    MessagePlugin.warning('请先填写API地址和密钥');
    return;
  }
  loadingModels.value = true;
  try {
    const res = await aiConfigAPI.fetchModels({
      api_base_url: config.value.api_base_url,
      api_key: config.value.api_key,
      protocol: config.value.protocol,
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
  } catch {}
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

const handleDeleteSkill = async (row) => {
  const confirmed = await DialogPlugin.confirm({
    header: '确认删除',
    body: `确定删除技能"${row.name}"吗？`,
    theme: 'warning',
    confirmBtn: { content: '确认', theme: 'danger' },
  });
  if (confirmed) {
    try {
      await aiConfigAPI.deleteSkill(row.id);
      MessagePlugin.success('删除成功');
      loadSkills();
    } catch {}
  }
};

const toggleSkill = async (row, val) => {
  try {
    await aiConfigAPI.updateSkill(row.id, { enabled: val ? 1 : 0 });
    loadSkills();
  } catch {}
};

onMounted(() => {
  loadConfig();
  loadSkills();
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
.config-form { max-width: 700px; margin-top: 16px; }
.model-select { display: flex; gap: 8px; width: 100%; }
.toolbar { display: flex; gap: 8px; margin-bottom: 12px; margin-top: 12px; flex-shrink: 0; }
</style>
