const express = require('express');
const cors = require('cors');
const fs = require('fs-extra');
const path = require('path');
const { exec } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// 데이터 디렉토리 (서버 내부)
const DATA_DIR = path.join(__dirname, 'data');
const projectsFile = path.join(DATA_DIR, 'projects.json');
const categoriesFile = path.join(DATA_DIR, 'categories.json');
const favoriteFile = path.join(DATA_DIR, 'favorite.txt');
const recentFile = path.join(DATA_DIR, 'recent.txt');

// 데이터 디렉토리 생성
fs.ensureDirSync(DATA_DIR);

// 기존 텍스트 파일을 JSON으로 마이그레이션
async function migrateToJSON() {
  const oldProjectsDisplayFile = path.join(DATA_DIR, 'projects_display.txt');
  const oldProjectsPathFile = path.join(DATA_DIR, 'projects_path.txt');
  const oldRoot = path.join(__dirname, '..');
  const oldRootProjectsDisplay = path.join(oldRoot, 'projects_display.txt');
  const oldRootProjectsPath = path.join(oldRoot, 'projects_path.txt');

  // JSON 파일이 없고 텍스트 파일이 있으면 마이그레이션
  if (!(await fs.pathExists(projectsFile))) {
    let projectNames = [];
    let projectPaths = [];

    // server/data의 파일 확인
    if (await fs.pathExists(oldProjectsDisplayFile)) {
      projectNames = (await fs.readFile(oldProjectsDisplayFile, 'utf8'))
        .split('\n')
        .map(line => line.trim())
        .filter(line => line);
    } else if (await fs.pathExists(oldRootProjectsDisplay)) {
      projectNames = (await fs.readFile(oldRootProjectsDisplay, 'utf8'))
        .split('\n')
        .map(line => line.trim())
        .filter(line => line);
    }

    if (await fs.pathExists(oldProjectsPathFile)) {
      projectPaths = (await fs.readFile(oldProjectsPathFile, 'utf8'))
        .split('\n')
        .map(line => line.trim())
        .filter(line => line);
    } else if (await fs.pathExists(oldRootProjectsPath)) {
      projectPaths = (await fs.readFile(oldRootProjectsPath, 'utf8'))
        .split('\n')
        .map(line => line.trim())
        .filter(line => line);
    }

    // 기본 카테고리 생성
    if (!(await fs.pathExists(categoriesFile))) {
      const defaultCategories = ['MWK', '집'];
      await fs.writeFile(categoriesFile, JSON.stringify(defaultCategories, null, 2), 'utf8');
    }

    // 프로젝트를 JSON으로 변환 (기본 카테고리는 첫 번째 카테고리)
    const categories = JSON.parse(await fs.readFile(categoriesFile, 'utf8'));
    const defaultCategory = categories[0] || '기본';

    const projects = projectNames.map((name, index) => ({
      id: Date.now() + index,
      name,
      path: projectPaths[index] || '',
      category: defaultCategory
    }));

    await fs.writeFile(projectsFile, JSON.stringify(projects, null, 2), 'utf8');
    console.log('Migrated to JSON format');
  }
}

// 파일 초기화
async function initFiles() {
  if (!(await fs.pathExists(projectsFile))) {
    await fs.writeFile(projectsFile, JSON.stringify([], null, 2), 'utf8');
  }
  if (!(await fs.pathExists(categoriesFile))) {
    await fs.writeFile(categoriesFile, JSON.stringify(['MWK', '집'], null, 2), 'utf8');
  }
  if (!(await fs.pathExists(favoriteFile))) {
    await fs.writeFile(favoriteFile, '', 'utf8');
  }
  if (!(await fs.pathExists(recentFile))) {
    await fs.writeFile(recentFile, '', 'utf8');
  }
}

// 서버 시작 시 마이그레이션 및 초기화
migrateToJSON().then(() => initFiles()).catch(console.error);

// 프로젝트 데이터 읽기
app.get('/api/projects', async (req, res) => {
  try {
    await initFiles();

    const projects = JSON.parse(await fs.readFile(projectsFile, 'utf8'));
    const categories = JSON.parse(await fs.readFile(categoriesFile, 'utf8'));

    const recentProjects = (await fs.readFile(recentFile, 'utf8'))
      .split('\n')
      .map(line => line.trim())
      .filter(line => line)
      .slice(0, 8);

    const favorites = (await fs.readFile(favoriteFile, 'utf8'))
      .split('\n')
      .map(line => line.trim())
      .filter(line => line);

    const projectsWithStatus = projects.map((project, index) => ({
      ...project,
      index: index + 1,
      isFavorite: favorites.includes(project.name),
      isRecent: recentProjects.includes(project.name)
    }));

    res.json({
      projects: projectsWithStatus,
      categories,
      recent: recentProjects,
      favorites
    });
  } catch (error) {
    console.error('Error reading projects:', error);
    res.status(500).json({ error: 'Failed to read projects' });
  }
});

// 프로젝트 열기
app.post('/api/open', async (req, res) => {
  try {
    const { projectPath, projectName, editor = 'cursor' } = req.body;

    if (!projectPath) {
      return res.status(400).json({ error: 'Project path is required' });
    }

    // 최근 목록 업데이트
    if (projectName) {
      let recentProjects = (await fs.readFile(recentFile, 'utf8'))
        .split('\n')
        .map(line => line.trim())
        .filter(line => line);

      recentProjects = recentProjects.filter(name => name !== projectName);
      recentProjects.unshift(projectName);
      recentProjects = recentProjects.slice(0, 8);

      await fs.writeFile(recentFile, recentProjects.join('\n'), 'utf8');
    }

    // 에디터별 실행
    let command
    if (editor === 'vscode') {
      // Cursor가 code 명령어를 덮어쓰기 때문에 VS Code 실행 파일 경로를 직접 사용
      const vscodePaths = [
        `"${process.env.LOCALAPPDATA}\\Programs\\Microsoft VS Code\\Code.exe"`,
        `"C:\\Program Files\\Microsoft VS Code\\Code.exe"`,
        `"C:\\Program Files (x86)\\Microsoft VS Code\\Code.exe"`,
      ]
      // 존재하는 경로 찾기
      let vscodeExe = null
      for (const p of vscodePaths) {
        const cleanPath = p.replace(/"/g, '')
        if (require('fs').existsSync(cleanPath)) {
          vscodeExe = p
          break
        }
      }
      if (vscodeExe) {
        command = `${vscodeExe} "${projectPath}"`
      } else {
        // 경로를 못 찾으면 code 명령어 시도
        command = `code "${projectPath}"`
      }
    } else {
      command = `cursor "${projectPath}"`
    }

    exec(command, (error) => {
      if (error) {
        console.error(`Error opening ${editor}:`, error);
        return res.status(500).json({ error: `Failed to open ${editor}` });
      }
      res.json({ success: true });
    });
  } catch (error) {
    console.error('Error opening project:', error);
    res.status(500).json({ error: 'Failed to open project' });
  }
});

// 폴더 열기
app.post('/api/open-folder', async (req, res) => {
  try {
    const { projectPath } = req.body;

    if (!projectPath) {
      return res.status(400).json({ error: 'Project path is required' });
    }

    // 경로 존재 확인
    if (!(await fs.pathExists(projectPath))) {
      return res.status(404).json({ error: 'Folder not found' });
    }

    // Windows에서는 explorer, macOS에서는 open, Linux에서는 xdg-open 사용
    let command;
    if (process.platform === 'win32') {
      // Windows에서 경로에 공백이 있을 때 문제가 발생할 수 있으므로 대안 방법 사용
      command = `explorer.exe "${projectPath.replace(/\//g, '\\')}"`;
    } else if (process.platform === 'darwin') {
      command = `open "${projectPath}"`;
    } else {
      command = `xdg-open "${projectPath}"`;
    }

    exec(command, (error) => {
      // Windows에서 explorer.exe는 성공해도 exit code 1을 반환하는 경우가 있어서
      // ENOENT(파일 없음) 같은 실제 오류만 처리
      if (error && error.code !== 1) {
        console.error('Error opening folder:', error);
        return res.status(500).json({ error: 'Failed to open folder' });
      }
      res.json({ success: true });
    });
  } catch (error) {
    console.error('Error opening folder:', error);
    res.status(500).json({ error: 'Failed to open folder' });
  }
});

// JSON 파일 열기 (notepad로)
app.post('/api/open-json', async (req, res) => {
  try {
    const { projectPath, jsonPath } = req.body;

    if (!projectPath || !jsonPath) {
      return res.status(400).json({ error: 'Project path and JSON path are required' });
    }

    // 상대 경로를 절대 경로로 변환
    const fullPath = path.resolve(projectPath, jsonPath);
    
    // 파일 존재 확인
    if (!(await fs.pathExists(fullPath))) {
      return res.status(404).json({ error: 'JSON file not found' });
    }

    // Windows에서는 notepad, macOS/Linux에서는 기본 텍스트 에디터 사용
    let command;
    if (process.platform === 'win32') {
      command = `notepad "${fullPath}"`;
    } else if (process.platform === 'darwin') {
      command = `open -a TextEdit "${fullPath}"`;
    } else {
      // Linux에서는 gedit, nano, 또는 기본 에디터 사용
      command = `gedit "${fullPath}" || nano "${fullPath}" || xdg-open "${fullPath}"`;
    }

    exec(command, (error) => {
      if (error) {
        console.error('Error opening JSON file:', error);
        return res.status(500).json({ error: 'Failed to open JSON file' });
      }
      res.json({ success: true });
    });
  } catch (error) {
    console.error('Error opening JSON file:', error);
    res.status(500).json({ error: 'Failed to open JSON file' });
  }
});

// 즐겨찾기 토글
app.post('/api/favorite', async (req, res) => {
  try {
    const { projectName } = req.body;

    if (!projectName) {
      return res.status(400).json({ error: 'Project name is required' });
    }

    let favorites = (await fs.readFile(favoriteFile, 'utf8'))
      .split('\n')
      .map(line => line.trim())
      .filter(line => line);

    if (favorites.includes(projectName)) {
      favorites = favorites.filter(name => name !== projectName);
    } else {
      favorites.push(projectName);
    }

    await fs.writeFile(favoriteFile, favorites.join('\n'), 'utf8');

    res.json({ success: true, favorites });
  } catch (error) {
    console.error('Error toggling favorite:', error);
    res.status(500).json({ error: 'Failed to toggle favorite' });
  }
});

// 프로젝트 추가
app.post('/api/projects', async (req, res) => {
  try {
    const { projectName, projectPath, category, subcategory, color, memo, jsonPath } = req.body;

    if (!projectName || !projectPath || !category) {
      return res.status(400).json({ error: 'Project name, path, and category are required' });
    }

    const projects = JSON.parse(await fs.readFile(projectsFile, 'utf8'));

    // 중복 확인
    if (projects.some(p => p.name === projectName)) {
      return res.status(400).json({ error: 'Project name already exists' });
    }

    // 프로젝트 추가
    const newProject = {
      id: Date.now(),
      name: projectName,
      path: projectPath,
      category,
      subcategory: subcategory || null,
      color: color || null,
      memo: memo || null,
      jsonPath: jsonPath || null
    };

    projects.push(newProject);
    await fs.writeFile(projectsFile, JSON.stringify(projects, null, 2), 'utf8');

    res.json({ success: true });
  } catch (error) {
    console.error('Error adding project:', error);
    res.status(500).json({ error: 'Failed to add project' });
  }
});

// 프로젝트 수정
app.put('/api/projects/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { projectName, projectPath, category, subcategory, color, memo, jsonPath } = req.body;

    if (!projectName || !projectPath || !category) {
      return res.status(400).json({ error: 'Project name, path, and category are required' });
    }

    const projects = JSON.parse(await fs.readFile(projectsFile, 'utf8'));
    const projectIndex = projects.findIndex(p => p.id === parseInt(id));

    if (projectIndex === -1) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // 이름 변경 시 즐겨찾기와 최근 목록 업데이트
    const oldName = projects[projectIndex].name;
    if (oldName !== projectName) {
      // 즐겨찾기 업데이트
      let favorites = (await fs.readFile(favoriteFile, 'utf8'))
        .split('\n')
        .map(line => line.trim())
        .filter(line => line);
      
      const favIndex = favorites.indexOf(oldName);
      if (favIndex !== -1) {
        favorites[favIndex] = projectName;
        await fs.writeFile(favoriteFile, favorites.join('\n'), 'utf8');
      }

      // 최근 목록 업데이트
      let recentProjects = (await fs.readFile(recentFile, 'utf8'))
        .split('\n')
        .map(line => line.trim())
        .filter(line => line);
      
      const recentIndex = recentProjects.indexOf(oldName);
      if (recentIndex !== -1) {
        recentProjects[recentIndex] = projectName;
        await fs.writeFile(recentFile, recentProjects.join('\n'), 'utf8');
      }
    }

    // 프로젝트 업데이트
    projects[projectIndex] = {
      ...projects[projectIndex],
      name: projectName,
      path: projectPath,
      category,
      subcategory: subcategory || null,
      color: color || null,
      memo: memo || null,
      jsonPath: jsonPath || null
    };

    await fs.writeFile(projectsFile, JSON.stringify(projects, null, 2), 'utf8');

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating project:', error);
    res.status(500).json({ error: 'Failed to update project' });
  }
});

// 프로젝트 삭제
app.delete('/api/projects/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const projects = JSON.parse(await fs.readFile(projectsFile, 'utf8'));
    const projectIndex = projects.findIndex(p => p.id === parseInt(id));

    if (projectIndex === -1) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const projectName = projects[projectIndex].name;

    // 즐겨찾기에서 제거
    let favorites = (await fs.readFile(favoriteFile, 'utf8'))
      .split('\n')
      .map(line => line.trim())
      .filter(line => line)
      .filter(name => name !== projectName);
    await fs.writeFile(favoriteFile, favorites.join('\n'), 'utf8');

    // 최근 목록에서 제거
    let recentProjects = (await fs.readFile(recentFile, 'utf8'))
      .split('\n')
      .map(line => line.trim())
      .filter(line => line)
      .filter(name => name !== projectName);
    await fs.writeFile(recentFile, recentProjects.join('\n'), 'utf8');

    // 프로젝트 삭제
    projects.splice(projectIndex, 1);
    await fs.writeFile(projectsFile, JSON.stringify(projects, null, 2), 'utf8');

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting project:', error);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

// 카테고리 목록 조회
app.get('/api/categories', async (req, res) => {
  try {
    await initFiles();
    const categories = JSON.parse(await fs.readFile(categoriesFile, 'utf8'));
    res.json({ categories });
  } catch (error) {
    console.error('Error reading categories:', error);
    res.status(500).json({ error: 'Failed to read categories' });
  }
});

// 카테고리 추가
app.post('/api/categories', async (req, res) => {
  try {
    const { categoryName } = req.body;

    if (!categoryName || !categoryName.trim()) {
      return res.status(400).json({ error: 'Category name is required' });
    }

    const categories = JSON.parse(await fs.readFile(categoriesFile, 'utf8'));

    if (categories.includes(categoryName.trim())) {
      return res.status(400).json({ error: 'Category already exists' });
    }

    categories.push(categoryName.trim());
    await fs.writeFile(categoriesFile, JSON.stringify(categories, null, 2), 'utf8');

    res.json({ success: true, categories });
  } catch (error) {
    console.error('Error adding category:', error);
    res.status(500).json({ error: 'Failed to add category' });
  }
});

// 카테고리 삭제
app.delete('/api/categories/:name', async (req, res) => {
  try {
    const { name } = req.params;

    const categories = JSON.parse(await fs.readFile(categoriesFile, 'utf8'));
    const categoryIndex = categories.indexOf(name);

    if (categoryIndex === -1) {
      return res.status(404).json({ error: 'Category not found' });
    }

    // 해당 카테고리의 프로젝트 확인
    const projects = JSON.parse(await fs.readFile(projectsFile, 'utf8'));
    const projectsInCategory = projects.filter(p => p.category === name);

    if (projectsInCategory.length > 0) {
      return res.status(400).json({ 
        error: `Cannot delete category. ${projectsInCategory.length} project(s) are using this category.` 
      });
    }

    categories.splice(categoryIndex, 1);
    await fs.writeFile(categoriesFile, JSON.stringify(categories, null, 2), 'utf8');

    res.json({ success: true, categories });
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({ error: 'Failed to delete category' });
  }
});

// 프로덕션 환경에서 정적 파일 서빙
if (process.env.NODE_ENV === 'production') {
  const clientBuildPath = path.join(__dirname, '..', 'client', 'dist');
  app.use(express.static(clientBuildPath));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientBuildPath, 'index.html'));
  });
}

// Windows에서 콘솔 인코딩을 UTF-8로 설정
if (process.platform === 'win32') {
  const { exec } = require('child_process');
  exec('chcp 65001 >nul', (error) => {
    if (error) {
      // chcp 명령 실패 시 무시
    }
  });
}

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  if (process.env.NODE_ENV === 'production') {
    console.log('Production mode: Serving static files from client/dist');
  }
});
