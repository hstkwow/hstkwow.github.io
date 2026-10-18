---
title: "TMMFNet"
topic: "Pansharpening"
started_at: "2026-09-20T11:26:34+08:00"
finished_at: "2026-09-23T16:59:45+08:00"
paper_url: "https://doi.org/10.1109/TGRS.2025.3604447"
---

## 整体框架

![截屏2026-09-21 09.46.08](images/framework.png)

## 核心模块

### 基于 CoT 的语义描述生成

LRMS 图像 → Real-ESRGAN 超分辨率增强 → SAMGeo 生成分割图 → 将超分辨率图、分割图及卫星信息输入 GPT-4o → CoT 引导场景分析 → 生成遥感**图像描述** → CLIP 将其转化为**文本特征** → 用于接下来的引导 PAN 与 MS 融合，生成分割图帮助gpt-4o来理解图片

### 文本增强与调制：TEB / TMB

LRMS上采样然后进入编码器，然后进行特征提取，随后和生成的文本特征进入多轮TEB和TMB，生成MS和文本融合特征。

#### TEB（textual enhancement block）

上一轮TEB和TMB生成的MS特征和CLIP生成文本特征一起进入TEB，先分别进行预处理，然后进行交叉注意力，MS特征做Query，文本特征做Key、Value，生成MS融合文本语义的特征
#### TMB（textual modulated block）

TEB的输出、CLIP生成的文本特征\(F_t\)、可学习提示(prompt)特征\(F_p\)进入TMB。首先\(F_t和F_p\)拼接然后执行注意力和残差连接，然后进入多层感知机MLP，输出两个参数，视觉特征\(F_{ms}\)进行自注意力处理和残差连接，然后用生成的两个参数进行缩放和平移，最后通过前向网络和残差连接生成MS图像融合特征。

### 视觉融合模块

MS特征和PAN特征进行融合，使用交叉注意力，Query取自MS的图像特征，Key和Value取自PAN的图像特征，融合后经过解码和双三次差值后的LRMS图像进行残差连接，最后得到HRMS图像

## 损失函数

采用L1损失，就是输出和真实的差距
