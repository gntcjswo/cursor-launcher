import { useState, useEffect, useRef } from 'react'
import { FaStar, FaRegStar, FaPlus, FaTimes, FaEdit, FaTrash, FaFolder, FaSignInAlt, FaSignOutAlt, FaUserShield, FaCheck, FaChevronDown } from 'react-icons/fa'
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth'
import { auth, googleProvider } from './firebase'
import {
  getProjects,
  addProject,
  updateProject,
  deleteProject,
  getCategories,
  addCategory,
  updateCategory,
  deleteCategory,
  getFavorites,
  toggleFavorite,
  getRecent,
  addRecent,
  checkPermission,
  getUserSettings,
  updateUserSettings
} from './firebaseService'
import './App.css'

function App() {
  const [projects, setProjects] = useState([])
  const [categories, setCategories] = useState([])
  const [recent, setRecent] = useState([])
  const [favorites, setFavorites] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [messageVisible, setMessageVisible] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [editingProject, setEditingProject] = useState(null)
  const [newProjectName, setNewProjectName] = useState('')
  const [newProjectPath, setNewProjectPath] = useState('')
  const [newProjectCategory, setNewProjectCategory] = useState('')
  const [newCategoryName, setNewCategoryName] = useState('')
  const [editingCategory, setEditingCategory] = useState(null)
  const [editingCategoryName, setEditingCategoryName] = useState('')
  const [editingCategoryColor, setEditingCategoryColor] = useState('#667eea')
  const [newCategoryColor, setNewCategoryColor] = useState('#667eea')
  const [user, setUser] = useState(null)
  const [isAllowed, setIsAllowed] = useState(false)
  const [showRecent, setShowRecent] = useState(true)
  const [showFavorites, setShowFavorites] = useState(true)
  const isInitialLoad = useRef(true)

  // 이메일 마스킹 함수
  const maskEmail = (email) => {
    if (!email) return ''
    const [localPart, domain] = email.split('@')
    if (!domain) return email // @가 없으면 그대로 반환
    
    if (localPart.length <= 2) {
      // 2글자 이하면 그대로
      return email
    } else if (localPart.length === 3) {
      // 3글자면 처음 2글자만 보이고 나머지는 *
      return `${localPart.substring(0, 2)}*@${domain}`
    } else {
      // 4글자 이상이면 처음 2글자 + * (나머지-1개) + 마지막 글자
      const firstTwo = localPart.substring(0, 2)
      const lastOne = localPart.substring(localPart.length - 1)
      const masked = '*'.repeat(localPart.length - 3)
      return `${firstTwo}${masked}${lastOne}@${domain}`
    }
  }

  useEffect(() => {
    // 인증 상태 감지
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser)
      if (currentUser) {
        const allowed = await checkPermission()
        setIsAllowed(allowed)
        // 사용자 설정 불러오기
        const settings = await getUserSettings()
        isInitialLoad.current = true
        setShowRecent(settings.showRecent)
        setShowFavorites(settings.showFavorites)
        // 설정 로드 후 플래그 리셋
        setTimeout(() => {
          isInitialLoad.current = false
        }, 100)
      } else {
        setIsAllowed(false)
        // 로그아웃 시 기본값으로 설정
        isInitialLoad.current = true
        setShowRecent(true)
        setShowFavorites(true)
        setTimeout(() => {
          isInitialLoad.current = false
        }, 100)
      }
    })

    loadProjects()
    return () => unsubscribe()
  }, [])

  // body 배경색 동적 변경
  useEffect(() => {
    // 선택된 카테고리의 색상 가져오기
    const selectedCategoryData = categories.find(c => (c.name || c) === selectedCategory)
    const categoryColor = selectedCategoryData 
      ? (typeof selectedCategoryData === 'string' ? '#667eea' : (selectedCategoryData.color || '#667eea'))
      : '#667eea'
    
    const root = document.documentElement
    root.style.setProperty('--theme-color', categoryColor)
    
    // 배경 그라데이션을 위한 어두운 색상 계산
    const hexToRgb = (hex) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
      return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
      } : null
    }
    
    const rgb = hexToRgb(categoryColor)
    if (rgb) {
      // 어두운 버전 생성 (20% 어둡게)
      const darkR = Math.max(0, Math.floor(rgb.r * 0.8))
      const darkG = Math.max(0, Math.floor(rgb.g * 0.8))
      const darkB = Math.max(0, Math.floor(rgb.b * 0.8))
      const darkColor = `rgb(${darkR}, ${darkG}, ${darkB})`
      root.style.setProperty('--theme-color-dark', darkColor)
    }
  }, [categories, selectedCategory])

  // 메시지 애니메이션 제어
  useEffect(() => {
    if (message) {
      // 메시지가 설정되면 표시
      setTimeout(() => setMessageVisible(true), 10)
      
      // 3초 후 사라지기
      const timer = setTimeout(() => {
        setMessageVisible(false)
        // fadeOut 애니메이션 후 메시지 제거
        setTimeout(() => setMessage(''), 300)
      }, 3000)
      
      return () => clearTimeout(timer)
    } else {
      setMessageVisible(false)
    }
  }, [message])

  const loadProjects = async () => {
    try {
      // 각 쿼리를 개별적으로 실행
      const projectsData = await getProjects().catch(err => {
        console.error('Error getting projects:', err)
        return []
      })
      
      const categoriesData = await getCategories().catch(err => {
        console.error('Error getting categories:', err)
        return ['기본']
      })
      
      const favoritesData = await getFavorites().catch(err => {
        console.error('Error getting favorites:', err)
        return []
      })
      
      const recentData = await getRecent().catch(err => {
        console.error('Error getting recent:', err)
        return []
      })

      // 프로젝트 데이터에 이미 isFavorite, isRecent 필드가 포함되어 있음
      const projectsWithStatus = projectsData.map((project, index) => ({
        ...project,
        index: index + 1,
        isFavorite: project.isFavorite || false,
        isRecent: project.isRecent || false
      }))

      setProjects(projectsWithStatus)
      setCategories(categoriesData)
      setRecent(recentData)
      setFavorites(favoritesData)
      
      if (!selectedCategory && categoriesData && categoriesData.length > 0) {
        setSelectedCategory(categoriesData[0].name || categoriesData[0])
      }
      setLoading(false)
    } catch (error) {
      console.error('Error loading projects:', error)
      setMessage('프로젝트를 불러오는데 실패했습니다: ' + error.message)
      setLoading(false)
    }
  }

  const handleOpenProject = async (project) => {
    if (!isAllowed) {
      setMessage('권한이 없습니다. 허용된 계정으로 로그인해주세요.')
      return
    }

    try {
      // 최근 목록에 추가
      await addRecent(project.name)

      // Cursor 실행 (백엔드 API 사용)
      const response = await fetch('http://localhost:3001/api/open', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectPath: project.path,
          projectName: project.name,
        }),
      })

      if (response.ok) {
        setMessage(`${project.name} 프로젝트를 열었습니다.`)
        setTimeout(() => {
          setMessage('')
          loadProjects()
        }, 1000)
      } else {
        setMessage('프로젝트를 여는데 실패했습니다.')
      }
    } catch (error) {
      console.error('Error opening project:', error)
      setMessage('프로젝트를 여는데 실패했습니다.')
    }
  }

  const handleToggleFavorite = async (project) => {
    if (!isAllowed) {
      setMessage('권한이 없습니다. 허용된 계정으로 로그인해주세요.')
      return
    }

    try {
      const isFavorite = project.isFavorite
      await toggleFavorite(project.name, !isFavorite)
      
      // 프로젝트 목록 새로고침 (isFavorite 필드가 업데이트됨)
      loadProjects()
    } catch (error) {
      console.error('Error toggling favorite:', error)
      setMessage('즐겨찾기 변경에 실패했습니다.')
    }
  }

  const handleLogin = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider)
      const userEmail = result.user.email
      
      const allowed = await checkPermission()
      setIsAllowed(allowed)
      
      if (!allowed) {
        setMessage(`허용되지 않은 계정입니다 (${userEmail}). Firebase Console에서 allowedUsers 컬렉션에 이메일을 추가하세요.`)
      } else {
        setMessage('로그인 성공! 모든 기능을 사용할 수 있습니다.')
        // 로그인 후 기본 카테고리 생성 시도
        const categories = await getCategories()
        if (categories.length === 0 || (categories.length === 1 && categories[0] === '기본')) {
          try {
            await addCategory('기본')
            loadProjects() // 카테고리 추가 후 목록 새로고침
          } catch (err) {
            // 기본 카테고리가 이미 존재하거나 생성 실패
          }
        }
      }
    } catch (error) {
      console.error('Error signing in:', error)
      if (error.code === 'auth/configuration-not-found') {
        setMessage('Google 로그인이 설정되지 않았습니다. Firebase Console에서 Google 로그인을 활성화하세요.')
      } else if (error.code === 'auth/popup-blocked') {
        setMessage('팝업이 차단되었습니다. 브라우저 설정에서 팝업을 허용하세요.')
      } else if (error.code === 'auth/popup-closed-by-user') {
        setMessage('로그인 팝업이 닫혔습니다.')
      } else {
        setMessage('로그인에 실패했습니다: ' + (error.message || error.code))
      }
    }
  }

  const handleLogout = async () => {
    try {
      await signOut(auth)
      setIsAllowed(false)
      setMessage('로그아웃되었습니다.')
      // 로그아웃 시 기본값으로 설정
      setShowRecent(true)
      setShowFavorites(true)
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  // showRecent와 showFavorites 변경 시 Firebase에 저장
  useEffect(() => {
    if (isInitialLoad.current || !user) {
      return
    }
    
    const saveSettings = async () => {
      try {
        await updateUserSettings({ showRecent, showFavorites })
      } catch (error) {
        console.error('Error updating user settings:', error)
        setMessage('설정 저장에 실패했습니다: ' + (error.message || error.code))
      }
    }
    
    saveSettings()
  }, [showRecent, showFavorites, user])

  const handleShowRecentChange = (checked) => {
    setShowRecent(checked)
  }

  const handleShowFavoritesChange = (checked) => {
    setShowFavorites(checked)
  }

  const handleAddProject = async (e) => {
    e.preventDefault()
    
    if (!isAllowed) {
      setMessage('권한이 없습니다. 허용된 계정으로 로그인해주세요.')
      return
    }
    
    if (!newProjectName.trim() || !newProjectPath.trim() || !newProjectCategory) {
      setMessage('프로젝트명, 경로, 카테고리를 모두 입력해주세요.')
      return
    }

    try {
      // 중복 확인
      const existingProjects = await getProjects()
      if (existingProjects.some(p => p.name === newProjectName.trim())) {
        setMessage('이미 존재하는 프로젝트명입니다.')
        return
      }

      await addProject({
        name: newProjectName.trim(),
        path: newProjectPath.trim(),
        category: newProjectCategory
      })

      setMessage('프로젝트가 추가되었습니다.')
      // 카테고리는 유지하고 프로젝트명과 경로만 비우기
      setNewProjectName('')
      setNewProjectPath('')
      setShowAddModal(false)
      setTimeout(() => {
        setMessage('')
        loadProjects()
      }, 1000)
    } catch (error) {
      console.error('Error adding project:', error)
      setMessage('프로젝트 추가에 실패했습니다.')
    }
  }

  const handleEditProject = (project) => {
    setEditingProject(project)
    setNewProjectName(project.name)
    setNewProjectPath(project.path)
    setNewProjectCategory(project.category)
    setShowEditModal(true)
  }

  const handleUpdateProject = async (e) => {
    e.preventDefault()
    
    if (!isAllowed) {
      setMessage('권한이 없습니다. 허용된 계정으로 로그인해주세요.')
      return
    }
    
    if (!newProjectName.trim() || !newProjectPath.trim() || !newProjectCategory) {
      setMessage('프로젝트명, 경로, 카테고리를 모두 입력해주세요.')
      return
    }

    try {
      // 프로젝트 업데이트 (isFavorite, isRecent는 그대로 유지)
      await updateProject(editingProject.id, {
        name: newProjectName.trim(),
        path: newProjectPath.trim(),
        category: newProjectCategory
      })

      setMessage('프로젝트가 수정되었습니다.')
      setShowEditModal(false)
      setEditingProject(null)
      setNewProjectName('')
      setNewProjectPath('')
      setNewProjectCategory('')
      setTimeout(() => {
        setMessage('')
        loadProjects()
      }, 1000)
    } catch (error) {
      console.error('Error updating project:', error)
      setMessage('프로젝트 수정에 실패했습니다.')
    }
  }

  const handleDeleteProject = async (project) => {
    if (!isAllowed) {
      setMessage('권한이 없습니다. 허용된 계정으로 로그인해주세요.')
      return
    }

    if (!confirm(`"${project.name}" 프로젝트를 삭제하시겠습니까?`)) {
      return
    }

    try {
      // 프로젝트 삭제 (isFavorite, isRecent 정보도 함께 삭제됨)
      await deleteProject(project.id)
      setMessage('프로젝트가 삭제되었습니다.')
      setTimeout(() => {
        setMessage('')
        loadProjects()
      }, 1000)
    } catch (error) {
      console.error('Error deleting project:', error)
      setMessage('프로젝트 삭제에 실패했습니다.')
    }
  }

  const handleAddCategory = async (e) => {
    e.preventDefault()
    
    if (!isAllowed) {
      setMessage('권한이 없습니다. 허용된 계정으로 로그인해주세요.')
      return
    }
    
    if (!newCategoryName.trim()) {
      setMessage('카테고리명을 입력해주세요.')
      return
    }

    try {
      const existingCategories = await getCategories()
      if (existingCategories.includes(newCategoryName.trim())) {
        setMessage('이미 존재하는 카테고리입니다.')
        return
      }

      await addCategory(newCategoryName.trim())
      const updatedCategories = await getCategories()
      setCategories(updatedCategories)
      setNewCategoryName('')
      setShowCategoryModal(false)
      setMessage('카테고리가 추가되었습니다.')
      setTimeout(() => setMessage(''), 2000)
    } catch (error) {
      console.error('Error adding category:', error)
      setMessage('카테고리 추가에 실패했습니다.')
    }
  }

  const handleEditCategory = (category) => {
    const categoryName = typeof category === 'string' ? category : category.name
    const categoryColor = typeof category === 'string' ? '#667eea' : (category.color || '#667eea')
    setEditingCategory(categoryName)
    setEditingCategoryName(categoryName)
    setEditingCategoryColor(categoryColor)
  }

  const handleUpdateCategory = async (e) => {
    e.preventDefault()
    if (!isAllowed) {
      setMessage('권한이 없습니다. 허용된 계정으로 로그인해주세요.')
      return
    }
    if (!editingCategory || !editingCategoryName.trim()) {
      setMessage('카테고리명을 입력해주세요.')
      return
    }
    const currentCategory = categories.find(c => (c.name || c) === editingCategory)
    const currentColor = currentCategory ? (typeof currentCategory === 'string' ? '#667eea' : (currentCategory.color || '#667eea')) : '#667eea'
    if (editingCategoryName === editingCategory && editingCategoryColor === currentColor) {
      setEditingCategory(null)
      setEditingCategoryName('')
      setEditingCategoryColor('#667eea')
      return
    }
    try {
      await updateCategory(editingCategory, editingCategoryName.trim(), editingCategoryColor)
      setMessage('카테고리가 수정되었습니다.')
      setEditingCategory(null)
      setEditingCategoryName('')
      setEditingCategoryColor('#667eea')
      loadProjects()
    } catch (error) {
      console.error('Error updating category:', error)
      setMessage('카테고리 수정에 실패했습니다.')
    }
  }

  const handleCancelEditCategory = () => {
    setEditingCategory(null)
    setEditingCategoryName('')
    setEditingCategoryColor('#667eea')
  }

  const handleDeleteCategory = async (categoryName) => {
    if (!isAllowed) {
      setMessage('권한이 없습니다. 허용된 계정으로 로그인해주세요.')
      return
    }

    if (!confirm(`"${categoryName}" 카테고리를 삭제하시겠습니까?`)) {
      return
    }

    try {
      // 해당 카테고리의 프로젝트 확인
      const allProjects = await getProjects()
      const projectsInCategory = allProjects.filter(p => p.category === categoryName)

      if (projectsInCategory.length > 0) {
        setMessage(`프로젝트가 있는 카테고리는 삭제할 수 없습니다. (${projectsInCategory.length}개 프로젝트)`)
        return
      }

      await deleteCategory(categoryName)
      const updatedCategories = await getCategories()
      setCategories(updatedCategories)
      
      if (selectedCategory === categoryName) {
        setSelectedCategory(updatedCategories[0] || null)
      }
      
      setMessage('카테고리가 삭제되었습니다.')
      setTimeout(() => {
        setMessage('')
        loadProjects()
      }, 1000)
    } catch (error) {
      console.error('Error deleting category:', error)
      setMessage('카테고리 삭제에 실패했습니다.')
    }
  }

  const filteredProjects = selectedCategory
    ? projects.filter(p => p.category === selectedCategory)
    : projects

  const recentProjects = filteredProjects.filter(p => recent.includes(p.name))
  const favoriteProjects = filteredProjects.filter(p => favorites.includes(p.name))

  // 선택된 카테고리의 색상 가져오기
  const selectedCategoryData = categories.find(c => (c.name || c) === selectedCategory)
  const selectedCategoryColor = selectedCategoryData 
    ? (typeof selectedCategoryData === 'string' ? '#667eea' : (selectedCategoryData.color || '#667eea'))
    : '#667eea'

  if (loading) {
  return (
    <div 
      className="app"
      style={{
        '--theme-color': selectedCategoryColor,
        '--theme-color-light': `${selectedCategoryColor}20`,
        '--theme-color-dark': selectedCategoryColor
      }}
    >
      <div className="container">
          <div className="loading">로딩 중...</div>
        </div>
      </div>
    )
  }

  return (
    <div 
      className="app"
      style={{
        '--theme-color': selectedCategoryColor,
        '--theme-color-light': `${selectedCategoryColor}20`,
        '--theme-color-dark': selectedCategoryColor
      }}
    >
      <div className="container">
        <div className="header">
          <h1 className="title">Cursor Launcher</h1>
          <div className="header-actions">
            {user ? (
              <>
                <span className="user-info">
                  {maskEmail(user.email)} {isAllowed && <FaUserShield className="allowed-badge" title="권한 있음" />}
                </span>
                <button 
                  className="logout-btn"
                  onClick={handleLogout}
                  title="로그아웃"
                >
                  <FaSignOutAlt />
                </button>
                {isAllowed && (
                  <>
                    <button 
                      className="add-btn"
                      onClick={() => {
                        // 카테고리는 마지막 선택한 것을 유지 (또는 현재 선택된 카테고리)
                        if (!newProjectCategory) {
                          const firstCategory = categories[0]
                          const firstCategoryName = typeof firstCategory === 'string' ? firstCategory : firstCategory?.name
                          setNewProjectCategory(selectedCategory || firstCategoryName || '')
                        }
                        setShowAddModal(true)
                      }}
                      title="프로젝트 추가"
                      style={{ color: selectedCategoryColor }}
                    >
                      <FaPlus />
                    </button>
                    <button 
                      className="category-btn"
                      onClick={() => setShowCategoryModal(true)}
                      title="카테고리 관리"
                      style={{ color: selectedCategoryColor }}
                    >
                      <FaFolder />
                    </button>
                  </>
                )}
              </>
            ) : (
              <button 
                className="login-btn"
                onClick={handleLogin}
                title="Google 로그인"
                style={{ color: selectedCategoryColor }}
              >
                <FaSignInAlt />
              </button>
            )}
          </div>
        </div>
        
        {message && (
          <div className={`message ${messageVisible ? 'visible' : ''}`}>{message}</div>
        )}

        {/* 카테고리 탭 */}
        <div className="tabs">
          {categories.map((category, index) => {
            const categoryName = typeof category === 'string' ? category : category.name
            const categoryColor = typeof category === 'string' ? '#667eea' : (category.color || '#667eea')
            return (
              <button
                key={categoryName || `category-${index}`}
                className={`tab ${selectedCategory === categoryName ? 'active' : ''}`}
                onClick={() => setSelectedCategory(categoryName)}
                style={{
                  '--tab-theme-color': categoryColor,
                  ...(selectedCategory === categoryName && {
                    background: 'white',
                    color: categoryColor,
                    borderColor: 'white'
                  })
                }}
              >
                {categoryName}
              </button>
            )
          })}
        </div>

        {/* 섹션 표시 옵션 */}
        <div className="section-options">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={showRecent}
              onChange={(e) => handleShowRecentChange(e.target.checked)}
            />
            <span>
              <FaCheck className="checkbox-icon" />
              Recent
            </span>
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={showFavorites}
              onChange={(e) => handleShowFavoritesChange(e.target.checked)}
            />
            <span>
              <FaCheck className="checkbox-icon" />
              Favorites
            </span>
          </label>
        </div>

        {/* 프로젝트 추가 모달 */}
        {showAddModal && (
          <div className="modal-overlay">
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>프로젝트 추가</h2>
                <button 
                  className="close-btn"
                  onClick={() => {
                    setNewProjectName('')
                    setNewProjectPath('')
                    setShowAddModal(false)
                  }}
                >
                  <FaTimes />
                </button>
              </div>
              <form onSubmit={handleAddProject}>
                <div className="form-group">
                  <label>프로젝트명</label>
                  <input
                    type="text"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    placeholder="예: My Project"
                    autoFocus
                  />
                </div>
                <div className="form-group">
                  <label>프로젝트 경로</label>
                  <input
                    type="text"
                    value={newProjectPath}
                    onChange={(e) => setNewProjectPath(e.target.value)}
                    placeholder="예: D:\project\my-project"
                  />
                </div>
                <div className="form-group">
                  <label>카테고리</label>
                  <div className="select-wrapper">
                    <select
                      value={newProjectCategory}
                      onChange={(e) => setNewProjectCategory(e.target.value)}
                    >
                      {categories.map(cat => {
                        const catName = typeof cat === 'string' ? cat : cat.name
                        return <option key={catName} value={catName}>{catName}</option>
                      })}
                    </select>
                    <FaChevronDown className="select-arrow" />
                  </div>
                </div>
                <div className="form-actions">
                  <button 
                    type="button" 
                    onClick={() => {
                      setNewProjectName('')
                      setNewProjectPath('')
                      setShowAddModal(false)
                    }}
                  >
                    취소
                  </button>
                  <button type="submit">추가</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* 프로젝트 수정 모달 */}
        {showEditModal && editingProject && (
          <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>프로젝트 수정</h2>
                <button 
                  className="close-btn"
                  onClick={() => setShowEditModal(false)}
                >
                  <FaTimes />
                </button>
              </div>
              <form onSubmit={handleUpdateProject}>
                <div className="form-group">
                  <label>프로젝트명</label>
                  <input
                    type="text"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    autoFocus
                  />
                </div>
                <div className="form-group">
                  <label>프로젝트 경로</label>
                  <input
                    type="text"
                    value={newProjectPath}
                    onChange={(e) => setNewProjectPath(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>카테고리</label>
                  <div className="select-wrapper">
                    <select
                      value={newProjectCategory}
                      onChange={(e) => setNewProjectCategory(e.target.value)}
                    >
                      {categories.map(cat => {
                        const catName = typeof cat === 'string' ? cat : cat.name
                        return <option key={catName} value={catName}>{catName}</option>
                      })}
                    </select>
                    <FaChevronDown className="select-arrow" />
                  </div>
                </div>
                <div className="form-actions">
                  <button type="button" onClick={() => setShowEditModal(false)}>
                    취소
                  </button>
                  <button type="submit">수정</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* 카테고리 관리 모달 */}
        {showCategoryModal && (
          <div className="modal-overlay" onClick={() => setShowCategoryModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>카테고리 관리</h2>
                <button 
                  className="close-btn"
                  onClick={() => setShowCategoryModal(false)}
                >
                  <FaTimes />
                </button>
              </div>
              <form onSubmit={handleAddCategory}>
                <div className="form-group">
                  <label>카테고리 추가</label>
                  <div className="input-with-button">
                    <input
                      type="text"
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      placeholder="예: 회사"
                      autoFocus
                    />
                    <input
                      type="color"
                      value={newCategoryColor}
                      onChange={(e) => setNewCategoryColor(e.target.value)}
                      className="color-picker"
                      title="색상 선택"
                    />
                    <button type="submit">추가</button>
                  </div>
                </div>
              </form>
              <div className="category-list">
                <h3>카테고리 목록</h3>
                {categories.map((category, index) => {
                  const categoryName = typeof category === 'string' ? category : category.name
                  const categoryColor = typeof category === 'string' ? '#667eea' : (category.color || '#667eea')
                  return (
                    <div key={categoryName || `category-item-${index}`} className="category-item">
                      {editingCategory === categoryName ? (
                        <form onSubmit={handleUpdateCategory} className="category-edit-form">
                          <input
                            type="text"
                            value={editingCategoryName}
                            onChange={(e) => setEditingCategoryName(e.target.value)}
                            autoFocus
                            className="category-edit-input"
                          />
                          <input
                            type="color"
                            value={editingCategoryColor}
                            onChange={(e) => setEditingCategoryColor(e.target.value)}
                            className="color-picker"
                            title="색상 선택"
                          />
                          <button type="submit" className="save-btn" title="저장">
                            <FaCheck />
                          </button>
                          <button 
                            type="button" 
                            onClick={handleCancelEditCategory} 
                            className="cancel-btn"
                            title="취소"
                          >
                            <FaTimes />
                          </button>
                        </form>
                      ) : (
                        <>
                          <div className="category-info">
                            <span 
                              className="category-color-indicator"
                              style={{ backgroundColor: categoryColor }}
                            ></span>
                            <span>{categoryName}</span>
                          </div>
                          <div className="category-actions">
                            <button
                              className="edit-btn"
                              onClick={() => handleEditCategory(category)}
                              title="수정"
                            >
                              <FaEdit />
                            </button>
                            <button
                              className="delete-btn"
                              onClick={() => handleDeleteCategory(categoryName)}
                              disabled={index === 0 || projects.some(p => p.category === categoryName)}
                              title={
                                index === 0 
                                  ? '첫 번째 카테고리는 삭제할 수 없습니다' 
                                  : projects.some(p => p.category === categoryName) 
                                    ? '프로젝트가 있는 카테고리는 삭제할 수 없습니다' 
                                    : '삭제'
                              }
                            >
                              <FaTrash />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {showRecent && recentProjects.length > 0 && (
          <section className="section">
            <h2 className="section-title">Recent</h2>
            <div className="project-grid">
              {recentProjects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  onOpen={handleOpenProject}
                  onToggleFavorite={handleToggleFavorite}
                  onEdit={handleEditProject}
                  onDelete={handleDeleteProject}
                  isAllowed={isAllowed}
                />
              ))}
            </div>
          </section>
        )}

        {showFavorites && favoriteProjects.length > 0 && (
          <section className="section">
            <h2 className="section-title">Favorites</h2>
            <div className="project-grid">
              {favoriteProjects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  onOpen={handleOpenProject}
                  onToggleFavorite={handleToggleFavorite}
                  onEdit={handleEditProject}
                  onDelete={handleDeleteProject}
                  isAllowed={isAllowed}
                />
              ))}
            </div>
          </section>
        )}

        <section className="section">
          <h2 className="section-title">All Projects</h2>
          {filteredProjects.length === 0 ? (
            <div className="empty-state">프로젝트가 없습니다.</div>
          ) : (
            <div className="project-grid">
              {filteredProjects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  onOpen={handleOpenProject}
                  onToggleFavorite={handleToggleFavorite}
                  onEdit={handleEditProject}
                  onDelete={handleDeleteProject}
                  isAllowed={isAllowed}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function ProjectCard({ project, onOpen, onToggleFavorite, onEdit, onDelete, isAllowed }) {
  return (
    <div className={`project-card ${!isAllowed ? 'not-allowed' : ''}`}>
      <div className="project-header">
        <span className="project-index">#{project.index}</span>
        {isAllowed && (
          <div className="project-actions">
            <button
              className={`favorite-btn ${project.isFavorite ? 'active' : ''}`}
              onClick={(e) => {
                e.stopPropagation()
                onToggleFavorite(project)
              }}
              title={project.isFavorite ? '즐겨찾기 제거' : '즐겨찾기 추가'}
            >
              {project.isFavorite ? <FaStar /> : <FaRegStar />}
            </button>
            <button
              className="edit-btn"
              onClick={(e) => {
                e.stopPropagation()
                onEdit(project)
              }}
              title="수정"
            >
              <FaEdit />
            </button>
            <button
              className="delete-btn"
              onClick={(e) => {
                e.stopPropagation()
                onDelete(project)
              }}
              title="삭제"
            >
              <FaTrash />
            </button>
          </div>
        )}
      </div>
      <div
        className="project-content"
        onClick={() => onOpen(project)}
      >
        <h3 className="project-name">{project.name}</h3>
        <p className="project-path">{project.path}</p>
        <span className="project-category">{project.category}</span>
      </div>
    </div>
  )
}

export default App
