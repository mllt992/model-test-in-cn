<template>
  <div class="page">
    <h2 class="page-title">模型测试</h2>

    <!-- 搜索栏 -->
    <div class="search-bar">
      <t-input v-model="search.keyword" placeholder="题目/生成内容/备注" style="width: 200px" @enter="loadData" />
      <t-select v-model="search.test_type" placeholder="测试类型" clearable filterable style="width: 140px">
        <t-option v-for="t in testTypeOptions" :key="t" :value="t" :label="t" />
      </t-select>
      <t-select v-model="search.risk_type" placeholder="安全风险项" clearable filterable style="width: 140px" @focus="loadRiskTypeOptions">
        <t-option v-for="t in riskTypeOptions" :key="t" :value="t" :label="t" />
      </t-select>
      <t-select v-model="search.risk_category" placeholder="风险类别" clearable filterable style="width: 140px" @focus="loadRiskCategoryOptions">
        <t-option v-for="c in riskCategoryOptions" :key="c" :value="c" :label="c" />
      </t-select>
      <t-select v-model="search.response_type" placeholder="回答类型" clearable filterable style="width: 140px">
        <t-option value="合理回答" label="合理回答" />
        <t-option value="合理拒答" label="合理拒答" />
        <t-option value="异常回复" label="异常回复" />
      </t-select>
      <t-select v-model="search.is_refused" placeholder="是否拒答" clearable filterable style="width: 120px">
        <t-option :value="1" label="是" />
        <t-option :value="0" label="否" />
      </t-select>
      <t-select v-model="search.match_result" placeholder="匹配" clearable filterable style="width: 100px">
        <t-option value="匹配" label="匹配" />
        <t-option value="不匹配" label="不匹配" />
      </t-select>
      <t-select v-model="search.human_audit" placeholder="人工审核" clearable style="width: 120px">
        <t-option value="合格" label="合格" />
        <t-option value="不合格" label="不合格" />
      </t-select>
      <t-button theme="primary" @click="loadData">搜索</t-button>
      <t-button variant="outline" @click="resetSearch">重置</t-button>
    </div>

    <!-- 功能栏 -->
    <div class="toolbar">
      <t-space>
        <t-select v-model="selectedAiConfig" placeholder="选择AI渠道" style="width: 200px" @change="handleAiConfigChange">
          <t-option v-for="c in aiConfigList" :key="c.id" :value="c.id" :label="c.name" />
        </t-select>
        <t-select v-model="testType" placeholder="测试类型" style="width: 140px">
          <t-option value="文本生成" label="文本生成" />
          <t-option value="图像生成" label="图像生成" />
          <t-option value="多模态" label="多模态" />
        </t-select>
      </t-space>

      <t-space>
        <t-button variant="outline" @click="showImportDialog">
          <template #icon><t-icon name="upload" /></template>
          上传文件
        </t-button>
        <t-button variant="outline" @click="showSelectQuestionsDialog">
          <template #icon><t-icon name="library" /></template>
          选择题库
        </t-button>
        <t-button theme="primary" @click="runSelectedTests" :loading="runningTests" :disabled="!selectedRows.length && !runningTests">
          <template #icon><t-icon name="play" /></template>
          <span v-if="runningTests && testProgress.total > 0">测试中 ({{ testProgress.current }}/{{ testProgress.total }})</span>
          <span v-else>开始测试 ({{ selectedRows.length }})</span>
        </t-button>
        <t-button variant="outline" @click="showExportDialog">
          <template #icon><t-icon name="download" /></template>
          导出
        </t-button>
        <t-button v-if="selectedRows.length" theme="danger" variant="outline" @click="handleBatchDelete">
          <template #icon><t-icon name="delete" /></template>
          批量删除 ({{ selectedRows.length }})
        </t-button>
        <t-button theme="danger" variant="outline" @click="handleDeleteAll" :disabled="!stats.total">
          <template #icon><t-icon name="delete" /></template>
          删除全部 ({{ stats.total }})
        </t-button>
      </t-space>
    </div>

    <!-- 统计卡片 -->
    <div class="stats-cards">
      <div class="stat-card">
        <div class="stat-value">{{ stats.total }}</div>
        <div class="stat-label">总测试数</div>
      </div>
      <div class="stat-card stat-normal">
        <div class="stat-value">{{ stats.normal_count }}</div>
        <div class="stat-label">合理回答</div>
      </div>
      <div class="stat-card stat-refused">
        <div class="stat-value">{{ stats.refused_count }}</div>
        <div class="stat-label">合理拒答</div>
      </div>
      <div class="stat-card stat-error">
        <div class="stat-value">{{ stats.error_count }}</div>
        <div class="stat-label">异常回复</div>
      </div>
      <div class="stat-card stat-match">
        <div class="stat-value">{{ stats.match_rate }}</div>
        <div class="stat-label">匹配率</div>
      </div>
      <div class="stat-card stat-pass">
        <div class="stat-value">{{ stats.pass_count }}</div>
        <div class="stat-label">合格</div>
      </div>
      <div class="stat-card stat-fail">
        <div class="stat-value">{{ stats.fail_count }}</div>
        <div class="stat-label">不合格</div>
      </div>
    </div>

    <!-- 表格 -->
    <div class="table-wrapper">
      <t-table :data="tableData" :columns="columns" row-key="id" hover stripe :pagination="null"
        :selected-row-keys="selectedRows" @select-change="handleSelectChange"
        table-layout="fixed" resizable
        @column-resize-change="handleColumnResizeChange"
      >
        <template #index="{ row }">{{ row.index }}</template>
        <template #test_type="{ row }">
          <t-select v-model="row.test_type" size="small" style="width: 100px" @change="handleFieldChange(row, 'test_type')">
            <t-option value="文本生成" label="文本生成" />
            <t-option value="图像生成" label="图像生成" />
            <t-option value="多模态" label="多模态" />
          </t-select>
        </template>
        <template #risk_category="{ row }">{{ row.risk_category || '-' }}</template>
        <template #is_refused="{ row }">
          <t-tag v-if="row.is_refused === 1" theme="warning" variant="outline">是</t-tag>
          <t-tag v-else-if="row.is_refused === 0" theme="success" variant="outline">否</t-tag>
          <span v-else style="color: #bbb">-</span>
        </template>
        <template #generated_content="{ row }">
          <span class="generated-content-cell">{{ row.generated_content || '-' }}</span>
        </template>
        <template #response_type="{ row }">
          <t-tag :theme="getResponseTypeTheme(row.response_type)" variant="outline">
            {{ row.response_type || '-' }}
          </t-tag>
        </template>
        <template #match_result="{ row }">
          <t-tag v-if="getMatchResult(row) === '匹配'" theme="success" variant="outline">✓</t-tag>
          <t-tag v-else-if="getMatchResult(row) === '不匹配'" theme="danger" variant="outline">✗</t-tag>
          <span v-else style="color: #bbb">-</span>
        </template>
        <template #human_audit="{ row }">
          <t-tag v-if="row.human_audit" :theme="row.human_audit === '合格' ? 'success' : 'danger'" variant="outline">
            {{ row.human_audit }}
          </t-tag>
          <span v-else style="color: #bbb">-</span>
        </template>
        <template #action="{ row }">
          <t-button variant="text" size="small" theme="primary" @click="runSingleTest(row)" :loading="runningIds.includes(row.id)">测试</t-button>
          <t-button variant="text" size="small" @click="handleViewContent(row)">查看</t-button>
          <t-button variant="text" size="small" theme="success" @click="handlePass(row)" :disabled="row.human_audit === '合格'">合格</t-button>
          <t-button variant="text" size="small" theme="danger" @click="handleFail(row)" :disabled="row.human_audit === '不合格'">不合格</t-button>
          <t-button variant="text" size="small" @click="handleEdit(row)">编辑</t-button>
          <t-button variant="text" size="small" theme="danger" @click="handleDelete(row)">删除</t-button>
        </template>
      </t-table>
    </div>

    <!-- 分页 -->
    <div class="pagination-wrapper">
      <t-pagination
        v-model="pagination.page"
        v-model:page-size="pagination.pageSize"
        :total="pagination.total"
        :page-size-options="[10, 20, 50, 100]"
        @change="loadData"
      />
    </div>

    <!-- 查看内容弹窗 -->
    <t-dialog v-model:visible="viewDialogVisible" header="查看详情" :footer="false" width="700px">
      <t-space direction="vertical" style="width: 100%" :size="16">
        <div class="detail-section">
          <h4>测试类型</h4>
          <div class="detail-content">{{ viewData.test_type }}</div>
        </div>
        <div class="detail-section">
          <h4>题目</h4>
          <div class="detail-content">{{ viewData.question }}</div>
        </div>
        <div class="detail-section">
          <h4>安全风险项</h4>
          <div class="detail-content">{{ viewData.risk_type || '-' }}</div>
        </div>
        <div class="detail-section">
          <h4>风险类别</h4>
          <div class="detail-content">{{ viewData.risk_category || '-' }}</div>
        </div>
        <div class="detail-section">
          <h4>是否拒答</h4>
          <div class="detail-content">
            <t-tag v-if="viewData.is_refused === 1" theme="warning" variant="outline">是</t-tag>
            <t-tag v-else-if="viewData.is_refused === 0" theme="success" variant="outline">否</t-tag>
            <span v-else>-</span>
          </div>
        </div>
        <div class="detail-section">
          <h4>生成内容</h4>
          <div class="detail-content generated-content">{{ viewData.generated_content || '-' }}</div>
        </div>
        <div class="detail-section">
          <h4>回答类型</h4>
          <div class="detail-content">
            <t-tag :theme="getResponseTypeTheme(viewData.response_type)" variant="outline">
              {{ viewData.response_type || '-' }}
            </t-tag>
          </div>
        </div>
        <div class="detail-section">
          <h4>人工审核</h4>
          <div class="detail-content">
            <t-tag v-if="viewData.human_audit" :theme="viewData.human_audit === '合格' ? 'success' : 'danger'" variant="outline">
              {{ viewData.human_audit }}
            </t-tag>
            <span v-else>-</span>
          </div>
        </div>
        <div class="detail-section">
          <h4>备注</h4>
          <div class="detail-content">{{ viewData.remark || '-' }}</div>
        </div>
        <div class="detail-meta">
          <span>AI渠道: {{ viewData.ai_config_name || '-' }}</span>
          <span>模型: {{ viewData.ai_model || '-' }}</span>
          <span>测试人: {{ viewData.tester_name || '-' }}</span>
        </div>
        <div style="text-align: right">
          <t-button variant="outline" @click="viewDialogVisible = false">关闭</t-button>
        </div>
      </t-space>
    </t-dialog>

    <!-- 编辑弹窗 -->
    <t-dialog v-model:visible="editDialogVisible" :header="isEdit ? '编辑记录' : '新增记录'" :footer="false" width="600px">
      <t-form :data="form" :rules="formRules" @submit="handleSubmit" label-width="120px">
        <t-form-item label="测试类型" name="test_type">
          <t-select v-model="form.test_type">
            <t-option value="文本生成" label="文本生成" />
            <t-option value="图像生成" label="图像生成" />
            <t-option value="多模态" label="多模态" />
          </t-select>
        </t-form-item>
        <t-form-item label="题目" name="question">
          <t-textarea v-model="form.question" placeholder="请输入题目" />
        </t-form-item>
        <t-form-item label="安全风险项" name="risk_type">
          <t-input v-model="form.risk_type" placeholder="如：文本生成、图像生成" />
        </t-form-item>
        <t-form-item label="风险类别" name="risk_category">
          <t-input v-model="form.risk_category" placeholder="请输入风险类别" />
        </t-form-item>
        <t-form-item label="生成内容" name="generated_content">
          <t-textarea v-model="form.generated_content" placeholder="AI生成的内容" />
        </t-form-item>
        <t-form-item label="回答类型" name="response_type">
          <t-select v-model="form.response_type">
            <t-option value="" label="未判断" />
            <t-option value="合理回答" label="合理回答" />
            <t-option value="合理拒答" label="合理拒答" />
            <t-option value="异常回复" label="异常回复" />
          </t-select>
        </t-form-item>
        <t-form-item label="人工审核" name="human_audit">
          <t-select v-model="form.human_audit">
            <t-option value="" label="未审核" />
            <t-option value="合格" label="合格" />
            <t-option value="不合格" label="不合格" />
          </t-select>
        </t-form-item>
        <t-form-item label="备注" name="remark">
          <t-textarea v-model="form.remark" placeholder="备注信息" />
        </t-form-item>
        <t-form-item>
          <t-button type="submit" theme="primary">{{ isEdit ? '保存' : '新增' }}</t-button>
          <t-button variant="outline" @click="editDialogVisible = false" style="margin-left: 12px">取消</t-button>
        </t-form-item>
      </t-form>
    </t-dialog>

    <!-- 导入弹窗 -->
    <t-dialog v-model:visible="importDialogVisible" header="导入测试题" width="800px" :footer="false">
      <t-space direction="vertical" style="width: 100%">
        <t-alert theme="info">支持 Excel (.xlsx/.xls)、CSV (.csv)、JSON (.json) 格式</t-alert>

        <!-- Step 1: 上传文件 -->
        <div v-if="importStep === 1">
          <t-upload ref="uploadRef" v-model="uploadFiles" accept=".xlsx,.xls,.csv,.json" :before-upload="() => true" :auto-upload="false" theme="file-input" />
          <t-button theme="primary" style="margin-top: 12px" @click="handlePreviewUpload" :loading="importing">解析文件</t-button>
        </div>

        <!-- Step 2: 字段映射 -->
        <div v-if="importStep === 2">
          <t-alert theme="success">已解析文件：{{ importFileName }}</t-alert>

          <div class="section-box">
            <h4>原始数据预览（前5行）</h4>
            <div class="preview-table">
              <table class="raw-preview-table">
                <thead>
                  <tr>
                    <th v-for="h in currentSheetData?.headers" :key="h">{{ h }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(row, ri) in currentSheetData?.preview" :key="ri">
                    <td v-for="(cell, ci) in row" :key="ci">{{ cell }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div class="section-box">
            <h4>字段映射</h4>
            <t-space direction="vertical" style="width: 100%">
              <t-space v-for="header in currentSheetData?.headers" :key="header" align="center">
                <span style="width: 160px; color: #333; font-weight: 500">{{ header }}</span>
                <span style="color: #bbb">→</span>
                <t-select v-model="fieldMapping[header]" placeholder="选择映射字段" style="width: 200px" clearable>
                  <t-option v-for="f in systemFields" :key="f.value" :value="f.value" :label="f.label" />
                </t-select>
              </t-space>
            </t-space>
          </div>

          <div style="text-align: right">
            <t-button @click="importStep = 1">重新选择文件</t-button>
            <t-button theme="primary" style="margin-left: 12px" @click="handleParseImport" :loading="importing">下一步</t-button>
          </div>
        </div>

        <!-- Step 3: 预览确认 -->
        <div v-if="importStep === 3">
          <t-alert theme="success" style="margin-bottom: 16px">解析成功，共 {{ parsedData.length }} 条记录</t-alert>
          <div class="preview-table">
            <t-table :data="parsedData.slice(0, 5)" row-key="index" :columns="previewColumns" />
          </div>
          <p v-if="parsedData.length > 5" style="color: #888; margin-top: 8px">仅显示前5条预览...</p>
          <div style="margin-top: 16px; text-align: right">
            <t-button @click="importStep = 2">返回修改</t-button>
            <t-button theme="primary" style="margin-left: 12px" @click="handleConfirmImport" :loading="importing">确认导入</t-button>
          </div>
        </div>
      </t-space>
    </t-dialog>

    <!-- 选择题库弹窗 -->
    <t-dialog v-model:visible="selectQuestionsDialogVisible" header="选择题库" width="1000px" :footer="false">
      <t-space direction="vertical" style="width: 100%">
        <t-alert theme="info">从系统题库中选择题目作为测试数据</t-alert>

        <div class="search-bar">
          <t-input v-model="questionSearch.keyword" placeholder="题目/类别/模型回答" style="width: 200px" @enter="loadQuestions" />
          <t-select v-model="questionSearch.type" placeholder="类型" clearable filterable style="width: 140px" @focus="loadQuestionOptions">
            <t-option v-for="t in questionTypeOptions" :key="t" :value="t" :label="t" />
          </t-select>
          <t-select v-model="questionSearch.category" placeholder="类别" clearable filterable style="width: 140px" @focus="loadQuestionOptions">
            <t-option v-for="c in questionCategoryOptions" :key="c" :value="c" :label="c" />
          </t-select>
          <t-select v-model="questionSearch.is_answered" placeholder="是否回答" clearable style="width: 120px">
            <t-option value="0" label="未回答" />
            <t-option value="1" label="已回答" />
          </t-select>
          <t-select v-model="questionSearch.is_refused" placeholder="是否拒答" clearable style="width: 100px">
            <t-option value="0" label="否" />
            <t-option value="1" label="是" />
          </t-select>
          <t-input v-model="questionSearch.audit_names" placeholder="审核人名字" style="width: 120px" @enter="loadQuestions" />
          <t-button theme="primary" @click="loadQuestions">搜索</t-button>
          <t-button variant="outline" @click="resetQuestionSearch">重置</t-button>
        </div>

        <div class="question-toolbar">
          <div class="question-toolbar-left">
            <t-checkbox
              :checked="isCurrentPageAllSelected"
              :indeterminate="isCurrentPagePartiallySelected"
              @change="handleToggleCurrentPage"
            >本页全选</t-checkbox>
            <t-button variant="outline" size="small" @click="handleSelectAll">全选全部 ({{ questionPagination.total }})</t-button>
            <t-button variant="outline" size="small" @click="showRandomSelectDialog">随机选择</t-button>
            <t-button variant="text" size="small" @click="handleClearSelection">清空选择</t-button>
          </div>
          <div class="question-toolbar-right">
            <span class="selected-count">已选 {{ selectedQuestionIds.length }} 条</span>
          </div>
        </div>

        <div class="table-wrapper-small">
          <t-table :data="questionList" :columns="questionColumns" row-key="id" hover stripe
            :pagination="null" ref="questionTableRef"
          >
            <template #row-select="{ row }">
              <t-checkbox
                :checked="selectedQuestionIds.includes(row.id)"
                :disabled="existingQuestionSet.has(row.question)"
                @change="() => toggleQuestionSelect(row, existingQuestionSet.has(row.question))"
              />
            </template>
            <template #question="{ row }">
              <span :class="{ 'existing-question': existingQuestionSet.has(row.question) }">
                {{ row.question }}
                <t-tag v-if="existingQuestionSet.has(row.question)" theme="default" size="small" variant="light">已存在</t-tag>
              </span>
            </template>
          </t-table>
        </div>

        <div class="question-pagination">
          <t-pagination
            v-model="questionPagination.page"
            v-model:page-size="questionPagination.pageSize"
            :total="questionPagination.total"
            :page-size-options="[10, 20, 50]"
            @change="loadQuestions"
          />
        </div>

        <div style="text-align: right">
          <t-button variant="outline" @click="selectQuestionsDialogVisible = false">取消</t-button>
          <t-button theme="primary" style="margin-left: 12px" @click="handleImportFromQuestions" :loading="importing">
            导入已选 ({{ selectedQuestionIds.length }})
          </t-button>
        </div>
      </t-space>
    </t-dialog>

    <!-- 导出弹窗 -->
    <t-dialog v-model:visible="exportDialogVisible" header="导出数据" width="500px">
      <t-form label-width="80px">
        <t-form-item label="导出格式">
          <t-select v-model="exportFormat">
            <t-option value="xlsx" label="Excel (.xlsx)" />
            <t-option value="csv" label="CSV" />
            <t-option value="json" label="JSON" />
          </t-select>
        </t-form-item>
        <t-form-item label="选择导出列">
          <t-space direction="vertical" style="width: 100%">
            <t-checkbox v-model="selectAllExportCols" @change="toggleAllExportCols">全选</t-checkbox>
            <t-checkbox-group v-model="selectedExportCols" :options="exportColumnOptions" />
          </t-space>
        </t-form-item>
        <t-form-item>
          <t-button theme="primary" @click="handleExport" :loading="exporting">确认导出</t-button>
        </t-form-item>
      </t-form>
    </t-dialog>

    <!-- 随机选择弹窗 -->
    <t-dialog v-model:visible="randomSelectDialogVisible" header="随机选择题目" :footer="false" width="400px">
      <t-form label-width="100px">
        <t-form-item label="总题目数">
          <span>{{ questionPagination.total }} 条</span>
        </t-form-item>
        <t-form-item label="已选题目数">
          <span>{{ selectedQuestionIds.length }} 条</span>
        </t-form-item>
        <t-form-item label="随机选择数量" name="randomCount">
          <t-input-number v-model="randomCount" :min="1" :max="questionPagination.total" placeholder="输入数量" />
        </t-form-item>
        <t-form-item>
          <t-space>
            <t-button theme="primary" @click="handleRandomSelect">确定</t-button>
            <t-button variant="outline" @click="randomSelectDialogVisible = false">取消</t-button>
          </t-space>
        </t-form-item>
      </t-form>
    </t-dialog>

    <!-- 确认删除弹窗 -->
    <t-dialog v-model:visible="confirmDeleteDialogVisible" header="确认删除" width="400px" :footer="false">
      <div style="padding: 16px 0;">
        <div style="margin-bottom: 16px;">{{ confirmDeleteText }}</div>
        <div style="text-align: right;">
          <t-button variant="outline" @click="confirmDeleteDialogVisible = false">取消</t-button>
          <t-button theme="danger" style="margin-left: 8px;" @click="handleConfirmDelete">确认删除</t-button>
        </div>
      </div>
    </t-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onBeforeUnmount } from 'vue';
import { MessagePlugin, DialogPlugin } from 'tdesign-vue-next';
import { testResultsAPI, aiConfigAPI, questionsAPI } from '@/api';

const user = JSON.parse(localStorage.getItem('user') || '{}');

// 搜索
const search = reactive({
  keyword: '',
  test_type: '',
  response_type: '',
  is_refused: '',
  match_result: '',
  human_audit: '',
  risk_type: '',
  risk_category: '',
});

const tableData = ref([]);
const selectedRows = ref([]);
const pagination = reactive({ page: 1, pageSize: 10, total: 0 });
const stats = reactive({
  total: 0,
  normal_count: 0,
  refused_count: 0,
  error_count: 0,
  pass_count: 0,
  fail_count: 0,
  match_count: 0,
  match_rate: '0%',
});

// 搜索选项
const riskTypeOptions = ref([]);
const riskCategoryOptions = ref([]);

// AI配置
const aiConfigList = ref([]);
const selectedAiConfig = ref(null);
const testType = ref('文本生成');

// 测试类型选项
const testTypeOptions = ref([]);

// 表格列配置
const allColumnDefs = [
  { colKey: 'row-select', type: 'multiple', width: 50, required: true },
  { colKey: 'index', title: '序号', width: 60, required: true },
  { colKey: 'test_type', title: '测试类型', width: 100, slot: 'test_type' },
  { colKey: 'question', title: '题目', width: 180, ellipsis: true },
  { colKey: 'risk_type', title: '安全风险项', width: 100, ellipsis: true },
  { colKey: 'risk_category', title: '风险类别', width: 100, ellipsis: true },
  { colKey: 'is_refused', title: '是否拒答', width: 90, slot: 'is_refused' },
  { colKey: 'generated_content', title: '生成内容', width: 180, ellipsis: true, slot: 'generated_content' },
  { colKey: 'response_type', title: '回答类型', width: 100, slot: 'response_type' },
  { colKey: 'match_result', title: '匹配', width: 70, slot: 'match_result' },
  { colKey: 'human_audit', title: '人工审核', width: 80, slot: 'human_audit' },
  { colKey: 'remark', title: '备注', width: 100, ellipsis: true },
  { colKey: 'created_at', title: '创建时间', width: 150 },
  { colKey: 'action', title: '操作', width: 200, slot: 'action', fixed: 'right', required: true },
];

const columns = computed(() => allColumnDefs.filter(c => c.required || visibleColumns.value.includes(c.colKey)));

const visibleColumns = ref(allColumnDefs.filter(c => !c.required).map(c => c.colKey));
const STORAGE_KEY_COLS = 'model_test_table_columns';

const loadVisibleColumns = () => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY_COLS)) || visibleColumns.value; } catch { return visibleColumns.value; }
};
visibleColumns.value = loadVisibleColumns();

const handleColumnResizeChange = ({ colKey, width }) => {
  const savedWidths = JSON.parse(localStorage.getItem('model_test_table_widths') || '{}');
  savedWidths[colKey] = width;
  localStorage.setItem('model_test_table_widths', JSON.stringify(savedWidths));
};

// 查看详情
const viewDialogVisible = ref(false);
const viewData = ref({});

const handleViewContent = (row) => {
  viewData.value = { ...row };
  viewDialogVisible.value = true;
};

// 编辑
const editDialogVisible = ref(false);
const isEdit = ref(false);
const editId = ref(null);
const form = ref({
  test_type: '文本生成',
  question: '',
  risk_type: '',
  risk_category: '',
  generated_content: '',
  response_type: '',
  human_audit: '',
  remark: '',
});
const formRules = { question: [{ required: true, message: '题目不能为空' }] };

const handleEdit = (row) => {
  isEdit.value = true;
  editId.value = row.id;
  form.value = {
    test_type: row.test_type || '文本生成',
    question: row.question,
    risk_type: row.risk_type || '',
    risk_category: row.risk_category || '',
    generated_content: row.generated_content || '',
    response_type: row.response_type || '',
    human_audit: row.human_audit || '',
    remark: row.remark || '',
  };
  editDialogVisible.value = true;
};

const handleSubmit = async ({ validateResult }) => {
  if (validateResult !== true) return;
  try {
    if (isEdit.value) {
      await testResultsAPI.update(editId.value, form.value);
      MessagePlugin.success('更新成功');
    } else {
      await testResultsAPI.create(form.value);
      MessagePlugin.success('新增成功');
    }
    editDialogVisible.value = false;
    loadData();
  } catch (e) {
    MessagePlugin.error(e?.response?.data?.message || '操作失败');
  }
};

// 审核
const handlePass = async (row) => {
  try {
    await testResultsAPI.update(row.id, { human_audit: '合格' });
    MessagePlugin.success('已标记为合格');
    loadData();
  } catch {}
};

const handleFail = async (row) => {
  try {
    await testResultsAPI.update(row.id, { human_audit: '不合格' });
    MessagePlugin.success('已标记为不合格');
    loadData();
  } catch {}
};

// 字段变更
const handleFieldChange = async (row, field) => {
  try {
    await testResultsAPI.update(row.id, { [field]: row[field] });
  } catch {}
};

// 运行测试
const runningTests = ref(false);
const runningIds = ref([]);
const testProgress = ref({ current: 0, total: 0 }); // WebSocket进度
let testWs = null; // WebSocket实例

const runSingleTest = async (row) => {
  if (!selectedAiConfig.value) {
    MessagePlugin.warning('请先选择AI渠道');
    return;
  }
  runningIds.value.push(row.id);
  try {
    await testResultsAPI.runTest(row.id, selectedAiConfig.value);
    MessagePlugin.success('测试完成');
    loadData();
  } catch (e) {
    MessagePlugin.error(e?.response?.data?.message || '测试失败');
  } finally {
    runningIds.value = runningIds.value.filter(id => id !== row.id);
  }
};

const runSelectedTests = async () => {
  if (!selectedRows.value.length) {
    MessagePlugin.warning('请选择要测试的记录');
    return;
  }
  if (!selectedAiConfig.value) {
    MessagePlugin.warning('请先选择AI渠道');
    return;
  }

  runningTests.value = true;
  testProgress.value = { current: 0, total: selectedRows.value.length };

  testWs = testResultsAPI.runBatchTestWebSocket(
    selectedRows.value,
    selectedAiConfig.value,
    // onProgress
    (progress) => {
      testProgress.value = { current: progress.current, total: progress.total };
      // 更新对应行的状态
      const row = tableData.value.find(r => r.id === progress.id);
      if (row) {
        row.generated_content = progress.generated_content || '';
        row.response_type = progress.response_type || '';
        runningIds.value.push(progress.id);
        setTimeout(() => {
          runningIds.value = runningIds.value.filter(id => id !== progress.id);
        }, 300);
      }
    },
    // onComplete
    (result) => {
      runningTests.value = false;
      testProgress.value = { current: 0, total: 0 };
      MessagePlugin.success(`测试完成: ${result.success}/${result.total} 成功`);
      loadData();
    },
    // onError - WebSocket失败时回退到HTTP请求
    async (error) => {
      console.warn('[测试] WebSocket失败，回退到HTTP请求:', error.message);
      try {
        const res = await testResultsAPI.runBatchTest(selectedRows.value, selectedAiConfig.value);
        MessagePlugin.success(res.message);
        loadData();
      } catch (e) {
        MessagePlugin.error(e?.response?.data?.message || '批量测试失败');
      } finally {
        runningTests.value = false;
        testProgress.value = { current: 0, total: 0 };
      }
    }
  );
};

const handleAiConfigChange = () => {
  const config = aiConfigList.value.find(c => c.id === selectedAiConfig.value);
  if (config) {
    MessagePlugin.info(`已选择: ${config.name} (${config.model})`);
  }
};

// 确认删除弹窗
const confirmDeleteDialogVisible = ref(false);
const confirmDeleteText = ref('');
const deleteCallback = ref(null);

const openConfirmDeleteDialog = (text, callback) => {
  confirmDeleteText.value = text;
  deleteCallback.value = callback;
  confirmDeleteDialogVisible.value = true;
};

const handleConfirmDelete = () => {
  confirmDeleteDialogVisible.value = false;
  if (deleteCallback.value) {
    deleteCallback.value();
  }
};

// 删除
const handleDelete = (row) => {
  openConfirmDeleteDialog('确定删除该测试记录吗？', async () => {
    try {
      await testResultsAPI.delete(row.id);
      MessagePlugin.success('删除成功');
      loadData();
    } catch {
      MessagePlugin.error('删除失败');
    }
  });
};

const handleBatchDelete = () => {
  openConfirmDeleteDialog(`确定删除选中的 ${selectedRows.value.length} 条记录吗？`, async () => {
    try {
      await testResultsAPI.batchDelete({ ids: selectedRows.value });
      MessagePlugin.success('批量删除成功');
      loadData();
    } catch {
      MessagePlugin.error('批量删除失败');
    }
  });
};

const handleDeleteAll = () => {
  openConfirmDeleteDialog(`确定删除全部 ${stats.total} 条测试记录吗？此操作不可恢复！`, async () => {
    try {
      await testResultsAPI.deleteAll();
      MessagePlugin.success('删除全部成功');
      loadData();
    } catch {
      MessagePlugin.error('删除全部失败');
    }
  });
};

const handleSelectChange = (value) => {
  selectedRows.value = value;
};

// 导入
const importDialogVisible = ref(false);
const importStep = ref(1);
const uploadFiles = ref([]);
const parsedData = ref([]);
const importing = ref(false);
const fieldMapping = ref({});
const importFileName = ref('');
const importSheets = ref([]);
const selectedSheet = ref('');

const systemFields = [
  { value: 'question', label: '题目' },
  { value: 'risk_type', label: '安全风险项' },
  { value: 'risk_category', label: '风险类别' },
  { value: 'test_type', label: '测试类型' },
];

const currentSheetData = computed(() => {
  if (!selectedSheet.value || !importSheets.value.length) return null;
  return importSheets.value.find(s => s.name === selectedSheet.value) || null;
});

const previewColumns = computed(() => {
  return systemFields.filter(f => parsedData.value[0] && parsedData.value[0][f.value] !== undefined)
    .map(f => ({ colKey: f.value, title: f.label }));
});

const showImportDialog = () => {
  importDialogVisible.value = true;
  importStep.value = 1;
  uploadFiles.value = [];
  parsedData.value = [];
  fieldMapping.value = {};
  importSheets.value = [];
  selectedSheet.value = '';
  importFileName.value = '';
};

const handlePreviewUpload = async () => {
  if (!uploadFiles.value.length) {
    MessagePlugin.warning('请先上传文件');
    return;
  }
  importing.value = true;
  try {
    const file = uploadFiles.value[0].raw;
    const formData = new FormData();
    formData.append('file', file);

    const res = await testResultsAPI.importPreview(formData);
    importSheets.value = res.data.sheets;
    importFileName.value = res.data.fileName;

    if (importSheets.value.length > 0) {
      selectedSheet.value = importSheets.value[0].name;
    }

    importStep.value = 2;
    MessagePlugin.success(`解析成功`);
  } catch (e) {
    MessagePlugin.error(e.message || '解析失败');
  } finally {
    importing.value = false;
  }
};

const handleParseImport = async () => {
  if (!uploadFiles.value.length) {
    MessagePlugin.warning('请重新选择文件');
    importStep.value = 1;
    return;
  }
  importing.value = true;
  try {
    const file = uploadFiles.value[0].raw;
    const formData = new FormData();
    formData.append('file', file);

    // 构建映射后的数据
    const headers = currentSheetData.value?.headers || [];
    const preview = currentSheetData.value?.preview || [];

    const records = preview.map(row => {
      const record = {};
      headers.forEach((header, i) => {
        const mappedField = fieldMapping.value[header] || header;
        if (mappedField) {
          record[mappedField] = row[i] || '';
        }
      });
      return record;
    });

    parsedData.value = records;
    importStep.value = 3;
    MessagePlugin.success('解析成功');
  } catch (e) {
    MessagePlugin.error(e.message || '解析失败');
  } finally {
    importing.value = false;
  }
};

const handleConfirmImport = async () => {
  if (!parsedData.value.length) {
    MessagePlugin.warning('没有可导入的数据');
    return;
  }
  importing.value = true;
  try {
    const config = aiConfigList.value.find(c => c.id === selectedAiConfig.value);
    await testResultsAPI.batchCreate({
      items: parsedData.value,
      ai_config_id: selectedAiConfig.value,
      ai_config_name: config?.name || '',
      ai_model: config?.model || '',
      tester_id: user.id,
      test_type: testType.value,
    });
    MessagePlugin.success('导入成功');
    importDialogVisible.value = false;
    loadData();
  } catch (e) {
    MessagePlugin.error(e?.response?.data?.message || '导入失败');
  } finally {
    importing.value = false;
  }
};

// 选择题库
const selectQuestionsDialogVisible = ref(false);
const questionList = ref([]);
const selectedQuestionIds = ref([]);
const existingQuestionSet = ref(new Set()); // 已存在于test_results的题目
const questionSearch = reactive({ keyword: '', type: '', category: '', is_answered: '', is_refused: '', audit_names: '' });
const questionPagination = reactive({ page: 1, pageSize: 10, total: 0 });
const questionTypeOptions = ref([]);
const questionCategoryOptions = ref([]);
const questionTableRef = ref(null);

// 随机选择
const randomSelectDialogVisible = ref(false);
const randomCount = ref(10);

// 当前页是否全选（排除已存在的题目）
const isCurrentPageAllSelected = computed(() => {
  if (!questionList.value.length) return false;
  const selectableRows = questionList.value.filter(row => !existingQuestionSet.value.has(row.question));
  if (selectableRows.length === 0) return true;
  return selectableRows.every(row => selectedQuestionIds.value.includes(row.id));
});

const isCurrentPagePartiallySelected = computed(() => {
  if (!questionList.value.length) return false;
  const selectableRows = questionList.value.filter(row => !existingQuestionSet.value.has(row.question));
  const selectedInPage = selectableRows.filter(row => selectedQuestionIds.value.includes(row.id)).length;
  return selectedInPage > 0 && selectedInPage < selectableRows.length;
});

const questionColumns = [
  { colKey: 'row-select', width: 50, slot: 'row-select' },
  { colKey: 'id', title: 'ID', width: 60 },
  { colKey: 'type', title: '类型', width: 100 },
  { colKey: 'category', title: '类别', width: 100 },
  { colKey: 'question', title: '题目', ellipsis: true },
];

const showSelectQuestionsDialog = async () => {
  selectQuestionsDialogVisible.value = true;
  selectedQuestionIds.value = [];
  // 加载已存在的题目ID
  try {
    const res = await testResultsAPI.getExistingQuestionIds();
    existingQuestionSet.value = new Set(res.data);
  } catch {
    existingQuestionSet.value = new Set();
  }
  loadQuestions();
  loadQuestionOptions();
};

const loadQuestions = async () => {
  try {
    const params = { page: questionPagination.page, pageSize: questionPagination.pageSize };
    if (questionSearch.keyword) params.keyword = questionSearch.keyword;
    if (questionSearch.type) params.type = questionSearch.type;
    if (questionSearch.category) params.category = questionSearch.category;
    if (questionSearch.is_answered !== '') params.is_answered = questionSearch.is_answered;
    if (questionSearch.is_refused !== '') params.is_refused = questionSearch.is_refused;
    if (questionSearch.audit_names) params.audit_names = questionSearch.audit_names;

    const res = await questionsAPI.list(params);
    questionList.value = res.data.list;
    questionPagination.total = res.data.total;
  } catch {}
};

const loadQuestionOptions = async () => {
  try {
    const [typesRes, categoriesRes] = await Promise.all([
      questionsAPI.getTypes(),
      questionsAPI.getCategories(),
    ]);
    questionTypeOptions.value = typesRes.data;
    questionCategoryOptions.value = categoriesRes.data;
  } catch {}
};

const resetQuestionSearch = () => {
  questionSearch.keyword = '';
  questionSearch.type = '';
  questionSearch.category = '';
  questionSearch.is_answered = '';
  questionSearch.is_refused = '';
  questionSearch.audit_names = '';
  questionPagination.page = 1;
  loadQuestions();
};

const toggleQuestionSelect = (row, isExisting) => {
  if (isExisting) return; // 已存在的题目不能选择
  const index = selectedQuestionIds.value.indexOf(row.id);
  if (index > -1) {
    selectedQuestionIds.value.splice(index, 1);
  } else {
    selectedQuestionIds.value.push(row.id);
  }
};

// 全选/取消当前页（排除已存在的题目）
const handleToggleCurrentPage = (checked) => {
  if (checked) {
    questionList.value.forEach(row => {
      if (!existingQuestionSet.value.has(row.question) && !selectedQuestionIds.value.includes(row.id)) {
        selectedQuestionIds.value.push(row.id);
      }
    });
  } else {
    questionList.value.forEach(row => {
      if (!existingQuestionSet.value.has(row.question)) {
        const index = selectedQuestionIds.value.indexOf(row.id);
        if (index > -1) {
          selectedQuestionIds.value.splice(index, 1);
        }
      }
    });
  }
};

// 全选全部（从服务器获取全部ID，排除已存在的题目）
const handleSelectAll = async () => {
  try {
    const params = { page: 1, pageSize: 999999 };
    if (questionSearch.keyword) params.keyword = questionSearch.keyword;
    if (questionSearch.type) params.type = questionSearch.type;
    if (questionSearch.category) params.category = questionSearch.category;

    const res = await questionsAPI.list(params);
    // 过滤掉已存在的题目
    const newIds = res.data.list
      .filter(item => !existingQuestionSet.value.has(item.question))
      .map(item => item.id);
    selectedQuestionIds.value = newIds;
    MessagePlugin.success(`已选中 ${newIds.length} 条（跳过 ${res.data.list.length - newIds.length} 条已存在的题目）`);
  } catch {
    MessagePlugin.error('全选失败');
  }
};

// 清空选择
const handleClearSelection = () => {
  selectedQuestionIds.value = [];
};

// 显示随机选择弹窗
const showRandomSelectDialog = () => {
  const selectableCount = questionList.value.filter(row => !existingQuestionSet.value.has(row.question)).length;
  randomCount.value = Math.min(10, selectableCount);
  randomSelectDialogVisible.value = true;
};

// 随机选择（排除已存在的题目）
const handleRandomSelect = async () => {
  const count = randomCount.value;

  try {
    const params = { page: 1, pageSize: 999999 };
    if (questionSearch.keyword) params.keyword = questionSearch.keyword;
    if (questionSearch.type) params.type = questionSearch.type;
    if (questionSearch.category) params.category = questionSearch.category;

    const res = await questionsAPI.list(params);
    // 过滤掉已存在的题目
    const selectableItems = res.data.list.filter(item => !existingQuestionSet.value.has(item.question));
    const selectableIds = selectableItems.map(item => item.id);

    if (selectableIds.length === 0) {
      MessagePlugin.warning('没有可选择的题目（都已存在）');
      randomSelectDialogVisible.value = false;
      return;
    }

    if (count > selectableIds.length) {
      MessagePlugin.warning(`可选题目只有 ${selectableIds.length} 条，已自动调整`);
      randomCount.value = selectableIds.length;
    }

    // Fisher-Yates 洗牌算法
    const shuffled = [...selectableIds];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    // 清空并添加随机选中的
    const actualCount = Math.min(count, selectableIds.length);
    selectedQuestionIds.value = shuffled.slice(0, actualCount);
    randomSelectDialogVisible.value = false;
    MessagePlugin.success(`已随机选中 ${actualCount} 条`);
  } catch {
    MessagePlugin.error('随机选择失败');
  }
};

const handleImportFromQuestions = async () => {
  if (!selectedQuestionIds.value.length) {
    MessagePlugin.warning('请选择题目');
    return;
  }
  importing.value = true;
  try {
    const config = aiConfigList.value.find(c => c.id === selectedAiConfig.value);
    await testResultsAPI.importFromQuestions({
      question_ids: selectedQuestionIds.value,
      ai_config_id: selectedAiConfig.value,
      ai_config_name: config?.name || '',
      ai_model: config?.model || '',
      tester_id: user.id,
      test_type: testType.value,
    });
    MessagePlugin.success('导入成功');
    selectQuestionsDialogVisible.value = false;
    loadData();
  } catch (e) {
    MessagePlugin.error(e?.response?.data?.message || '导入失败');
  } finally {
    importing.value = false;
  }
};

// 导出
const exportDialogVisible = ref(false);
const exportFormat = ref('xlsx');
const selectedExportCols = ref(['index', 'test_type', 'question', 'risk_type', 'risk_category', 'response_type', 'human_audit', 'remark']);
const selectAllExportCols = ref(true);
const exporting = ref(false);

const exportColumnOptions = [
  { value: 'index', label: '序号' },
  { value: 'test_type', label: '测试类型' },
  { value: 'question', label: '题目' },
  { value: 'risk_type', label: '安全风险项' },
  { value: 'risk_category', label: '风险类别' },
  { value: 'generated_content', label: '生成内容' },
  { value: 'response_type', label: '回答类型' },
  { value: 'human_audit', label: '人工审核' },
  { value: 'remark', label: '备注' },
  { value: 'ai_config_name', label: 'AI渠道' },
  { value: 'ai_model', label: '模型' },
  { value: 'tester_name', label: '测试人' },
  { value: 'created_at', label: '创建时间' },
];

const showExportDialog = () => {
  exportDialogVisible.value = true;
};

const toggleAllExportCols = (checked) => {
  selectedExportCols.value = checked ? exportColumnOptions.map(o => o.value) : [];
};

const handleExport = async () => {
  if (!selectedExportCols.value.length) {
    MessagePlugin.warning('请至少选择一列');
    return;
  }
  exporting.value = true;
  try {
    const columns = selectedExportCols.value.map(key => ({
      key,
      label: exportColumnOptions.find(o => o.value === key)?.label || key,
    }));
    const params = { columns, format: exportFormat.value };
    if (search.keyword) params.keyword = search.keyword;
    if (search.test_type) params.test_type = search.test_type;
    if (search.response_type) params.response_type = search.response_type;
    if (search.is_refused !== '') params.is_refused = search.is_refused;
    if (search.match_result) params.match_result = search.match_result;
    if (search.human_audit) params.human_audit = search.human_audit;
    if (search.risk_type) params.risk_type = search.risk_type;
    if (search.risk_category) params.risk_category = search.risk_category;

    const res = await testResultsAPI.export(params);

    const blob = new Blob([res], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `test_results.${exportFormat.value}`;
    a.click();
    URL.revokeObjectURL(url);
    exportDialogVisible.value = false;
    MessagePlugin.success('导出成功');
  } catch (e) {
    MessagePlugin.error(e.message || '导出失败');
  } finally {
    exporting.value = false;
  }
};

// 加载AI配置
const loadAiConfig = async () => {
  try {
    const res = await aiConfigAPI.list();
    aiConfigList.value = res.data || [];
  } catch {}
};

// 加载数据
const loadData = async () => {
  const params = {
    page: pagination.page,
    pageSize: pagination.pageSize,
  };
  if (search.keyword) params.keyword = search.keyword;
  if (search.test_type) params.test_type = search.test_type;
  if (search.response_type) params.response_type = search.response_type;
  if (search.is_refused !== '') params.is_refused = search.is_refused;
  if (search.match_result) params.match_result = search.match_result;
  if (search.human_audit) params.human_audit = search.human_audit;
  if (search.risk_type) params.risk_type = search.risk_type;
  if (search.risk_category) params.risk_category = search.risk_category;

  try {
    const res = await testResultsAPI.list(params);
    tableData.value = res.data.list;
    pagination.total = res.data.total;
    Object.assign(stats, res.data.stats);
    selectedRows.value = [];
  } catch (e) {
    MessagePlugin.error('加载数据失败');
  }
};

const resetSearch = () => {
  search.keyword = '';
  search.test_type = '';
  search.response_type = '';
  search.is_refused = '';
  search.match_result = '';
  search.human_audit = '';
  search.risk_type = '';
  search.risk_category = '';
  pagination.page = 1;
  loadData();
};

// 加载测试类型选项
const loadTestTypeOptions = async () => {
  try {
    const res = await testResultsAPI.getTestTypes();
    testTypeOptions.value = res.data;
  } catch {}
};

// 加载安全风险项选项（懒加载，点击下拉时触发）
const loadRiskTypeOptions = async () => {
  if (riskTypeOptions.value.length > 0) return; // 已加载
  try {
    const res = await testResultsAPI.getRiskTypes();
    riskTypeOptions.value = res.data || [];
  } catch {}
};

// 加载风险类别选项（懒加载，点击下拉时触发）
const loadRiskCategoryOptions = async () => {
  if (riskCategoryOptions.value.length > 0) return; // 已加载
  try {
    const res = await testResultsAPI.getRiskCategories();
    riskCategoryOptions.value = res.data || [];
  } catch {}
};

// 回答类型主题
const getResponseTypeTheme = (type) => {
  switch (type) {
    case '合理回答': return 'success';
    case '合理拒答': return 'warning';
    case '异常回复': return 'danger';
    default: return 'default';
  }
};

// 过滤图片标记，返回纯文本
const stripImageTags = (content) => {
  if (!content) return '';
  return content.replace(/\[Image:\s*source:\s*[^\]]+\]/g, '').trim();
};

// 匹配结果判断
const getMatchResult = (row) => {
  if (row.is_refused === undefined || row.is_refused === null || row.is_refused === -1) {
    return null; // 没有是否拒答数据
  }
  if (!row.response_type) {
    return null; // 还没有回答类型
  }
  // 匹配规则：is_refused=1 且 response_type='合理拒答' → 匹配
  //          is_refused=0 且 response_type='合理回答' → 匹配
  //          其他 → 不匹配
  if ((row.is_refused === 1 && row.response_type === '合理拒答') ||
      (row.is_refused === 0 && row.response_type === '合理回答')) {
    return '匹配';
  }
  return '不匹配';
};

onMounted(() => {
  loadData();
  loadAiConfig();
  loadTestTypeOptions();
});

onBeforeUnmount(() => {
  // 清理WebSocket连接
  if (testWs) {
    testWs.close();
    testWs = null;
  }
});
</script>

<style scoped>
.page { background: #fff; padding: 20px 24px; border-radius: 8px; height: 100%; overflow: hidden; display: flex; flex-direction: column; }
.page-title { font-size: 20px; margin-bottom: 16px; flex-shrink: 0; }
.search-bar { display: flex; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; align-items: center; flex-shrink: 0; }
.toolbar { display: flex; gap: 16px; margin-bottom: 12px; flex-shrink: 0; align-items: center; justify-content: space-between; flex-wrap: wrap; }
.stats-cards { display: flex; gap: 12px; margin-bottom: 12px; flex-shrink: 0; }
.stat-card { flex: 1; min-width: 100px; padding: 12px 16px; background: #f5f5f5; border-radius: 8px; text-align: center; }
.stat-card.stat-normal { background: #e6f7ff; }
.stat-card.stat-refused { background: #fff7e6; }
.stat-card.stat-error { background: #fff1f0; }
.stat-card.stat-match { background: #f6ffed; }
.stat-card.stat-pass { background: #f6ffed; }
.stat-card.stat-fail { background: #fff1f0; }
.stat-value { font-size: 24px; font-weight: 600; color: #333; }
.stat-label { font-size: 12px; color: #666; margin-top: 4px; }
.table-wrapper { flex: 1; overflow: hidden; min-height: 0; }
.table-wrapper :deep(.t-table) { height: 100%; display: flex; flex-direction: column; }
.table-wrapper :deep(.t-table__header) { flex-shrink: 0; }
.table-wrapper :deep(.t-table__body) { flex: 1; overflow-y: auto; }
.table-wrapper-small { max-height: 300px; overflow-y: auto; }
.pagination-wrapper { flex-shrink: 0; margin-top: 12px; }
.question-pagination { margin-top: 12px; }
.section-box { width: 100%; padding: 16px; background: #f5f5f5; border-radius: 8px; margin-top: 12px; }
.section-box h4 { margin-bottom: 12px; font-size: 14px; }
.preview-table { max-height: 200px; overflow-y: auto; border: 1px solid #e7e7e7; border-radius: 4px; }
.raw-preview-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.raw-preview-table th, .raw-preview-table td { border: 1px solid #e7e7e7; padding: 6px 10px; text-align: left; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.raw-preview-table th { background: #f5f5f5; font-weight: 500; color: #333; }
.detail-section { border-bottom: 1px solid #f0f0f0; padding-bottom: 12px; }
.detail-section h4 { font-size: 13px; color: #666; margin-bottom: 6px; }
.detail-content { font-size: 14px; color: #333; white-space: pre-wrap; }
.generated-content { max-height: 200px; overflow-y: auto; background: #f5f5f5; padding: 8px; border-radius: 4px; }
.detail-meta { display: flex; gap: 24px; font-size: 12px; color: #888; flex-wrap: wrap; }
.question-toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.question-toolbar-left { display: flex; gap: 8px; align-items: center; }
.question-toolbar-right { display: flex; gap: 8px; align-items: center; }
.selected-count { font-size: 13px; color: #0052d9; font-weight: 500; }
.generated-content-cell { cursor: pointer; }
.generated-content-cell:hover { color: #0052d9; }
.existing-question { color: #ccc; }
</style>
