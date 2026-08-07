import { useState, useEffect, useRef } from 'react'
import { FaStar, FaRegStar, FaPlus, FaTimes, FaEdit, FaTrash, FaFolder, FaSignInAlt, FaSignOutAlt, FaUserShield, FaCheck, FaChevronDown, FaArrowsAlt, FaGripVertical, FaCopy, FaStickyNote, FaFolderOpen, FaFileCode, FaCog } from 'react-icons/fa'
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
  addSubcategory,
  updateSubcategory,
  deleteSubcategory,
  getFavorites,
  toggleFavorite,
  getRecent,
  addRecent,
  removeRecent,
  checkPermission,
  getUserSettings,
  updateUserSettings,
  updateCategorySettings
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
  const [selectedCategory, setSelectedCategory] = useState(() => localStorage.getItem('selectedCategory') || null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [editingProject, setEditingProject] = useState(null)
  const [newProjectName, setNewProjectName] = useState('')
  const [newProjectPath, setNewProjectPath] = useState('')
  const [newProjectCategory, setNewProjectCategory] = useState('')
  const [newProjectSubcategory, setNewProjectSubcategory] = useState('')
  const [newProjectColor, setNewProjectColor] = useState('')
  const [newProjectMemo, setNewProjectMemo] = useState('')
  const [newProjectJsonPath, setNewProjectJsonPath] = useState('')
  const [enableJsonPath, setEnableJsonPath] = useState(false)
  const [showCategorySettingsModal, setShowCategorySettingsModal] = useState(false)
  const [selectedCategoryForSettings, setSelectedCategoryForSettings] = useState(null)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [editingCategory, setEditingCategory] = useState(null)
  const [editingCategoryName, setEditingCategoryName] = useState('')
  const [editingCategoryColor, setEditingCategoryColor] = useState('#667eea')
  const [newCategoryColor, setNewCategoryColor] = useState('#667eea')
  const [editingCategoryForSub, setEditingCategoryForSub] = useState(null)
  const [newSubcategoryName, setNewSubcategoryName] = useState('')
  const [editingSubcategory, setEditingSubcategory] = useState(null) // { categoryName, subcategoryName }
  const [editingSubcategoryName, setEditingSubcategoryName] = useState('')
  const [user, setUser] = useState(null)
  const [isAllowed, setIsAllowed] = useState(false)
  const [showRecent, setShowRecent] = useState(true)
  const [showFavorites, setShowFavorites] = useState(true)
  const [selectedSubcategories, setSelectedSubcategories] = useState([]) // 선택된 서브카테고리 목록
  const [sortMode, setSortMode] = useState(false)
  const [draggedProjectId, setDraggedProjectId] = useState(null)
  const [draggedOverProjectId, setDraggedOverProjectId] = useState(null)
  const [copyMode, setCopyMode] = useState(false)
  const [selectedProjectsForCopy, setSelectedProjectsForCopy] = useState([])
  const [deleteMode, setDeleteMode] = useState(false)
  const [selectedProjectsForDelete, setSelectedProjectsForDelete] = useState([])
  const [showCopyModal, setShowCopyModal] = useState(false)
  const [copyTargetCategory, setCopyTargetCategory] = useState('')
  const [copyTargetSubcategory, setCopyTargetSubcategory] = useState('')
  const [copyNewSubcategoryName, setCopyNewSubcategoryName] = useState('')
  const [copyEditingSubcategory, setCopyEditingSubcategory] = useState(null)
  const [copyEditingSubcategoryName, setCopyEditingSubcategoryName] = useState('')
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [confirmMessage, setConfirmMessage] = useState('')
  const [showMemoModal, setShowMemoModal] = useState(false)
  const [memoProject, setMemoProject] = useState(null)
  const confirmCallbackRef = useRef(null)
  const isInitialLoad = useRef(true)
  const dragTimerRef = useRef(null)
  const lastDragTargetRef = useRef({ projectId: null, insertPosition: null })

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

  // 모달 상태에 따른 body overflow 제어
  useEffect(() => {
    const isAnyModalOpen = showAddModal || showEditModal || showCategoryModal || showCopyModal || showConfirmModal || showMemoModal || showCategorySettingsModal;
    
    if (isAnyModalOpen) {
      document.body.classList.add('overflow-hidden');
    } else {
      document.body.classList.remove('overflow-hidden');
    }

    // 컴포넌트 언마운트 시 정리
    return () => {
      document.body.classList.remove('overflow-hidden');
    };
    }, [showAddModal, showEditModal, showCategoryModal, showCopyModal, showConfirmModal, showMemoModal, showCategorySettingsModal]);

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

      // 프로젝트 데이터에 이미 isFavorite, isRecent, index(number) 필드가 포함되어 있음
      const projectsWithStatus = projectsData.map((project) => ({
        ...project,
        // number 필드가 없으면 index 사용 (하위 호환성)
        index: project.number || project.index || 0,
        isFavorite: project.isFavorite || false,
        isRecent: project.isRecent || false
      }))

      setProjects(projectsWithStatus)
      setCategories(categoriesData)
      setRecent(recentData)
      setFavorites(favoritesData)
      
      if (categoriesData && categoriesData.length > 0) {
        const savedCategory = localStorage.getItem('selectedCategory')
        const savedCategoryExists = savedCategory && categoriesData.some(c => {
          const catName = typeof c === 'string' ? c : c.name
          return catName === savedCategory
        })

        const targetCategoryName = savedCategoryExists
          ? savedCategory
          : (typeof categoriesData[0] === 'string' ? categoriesData[0] : categoriesData[0].name)

        const targetCategory = categoriesData.find(c => {
          const catName = typeof c === 'string' ? c : c.name
          return catName === targetCategoryName
        })

        if (!selectedCategory || !savedCategoryExists) {
          setSelectedCategory(targetCategoryName)
          localStorage.setItem('selectedCategory', targetCategoryName)
        }

        const subcategories = targetCategory && typeof targetCategory !== 'string' ? (targetCategory.subcategories || []) : []
        setSelectedSubcategories([...subcategories, null])
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

      // 카테고리 설정에서 기본 에디터 가져오기
      const categoryData = categories.find(c => {
        const catName = typeof c === 'string' ? c : c.name
        return catName === project.category
      })
      const defaultEditor = (categoryData && typeof categoryData !== 'string' && categoryData.settings) 
        ? categoryData.settings.defaultEditor || 'cursor'
        : 'cursor'

      // API URL 설정 (환경 변수 또는 기본값)
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'
      
      // 백엔드 API 호출 시도
      try {
        const response = await fetch(`${apiUrl}/api/open`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectPath: project.path,
          projectName: project.name,
          editor: defaultEditor,
        }),
      })

      if (response.ok) {
        setMessage(`${project.name} 프로젝트를 열었습니다.`)
        setTimeout(() => {
          setMessage('')
          loadProjects()
        }, 1000)
          return
      } else {
          throw new Error('API 응답 오류')
        }
      } catch (apiError) {
        // API 호출 실패 시 (백엔드 서버가 실행되지 않은 경우)
        console.warn('백엔드 서버에 연결할 수 없습니다. 경로를 클립보드에 복사합니다.', apiError)
        
        // 경로를 클립보드에 복사
        try {
          await navigator.clipboard.writeText(project.path)
          setMessage(`${project.name} 프로젝트 경로가 클립보드에 복사되었습니다.\n\n백엔드 서버가 실행 중이 아닙니다. Cursor에서 직접 열어주세요.\n경로: ${project.path}`)
        } catch (clipboardError) {
          // 클립보드 복사 실패 시 경로를 표시
          setMessage(`${project.name} 프로젝트 경로: ${project.path}\n\n백엔드 서버가 실행 중이 아닙니다. Cursor에서 직접 열어주세요.`)
        }
        setTimeout(() => {
          setMessage('')
          loadProjects()
        }, 4000)
      }
    } catch (error) {
      console.error('Error opening project:', error)
      setMessage(`프로젝트를 여는데 실패했습니다: ${error.message}`)
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

  // 확인 모달을 표시하는 헬퍼 함수
  const showConfirm = (message, callback) => {
    // 콜백이 있으면 ref에 저장 (실행하지 않음)
    setConfirmMessage(message)
    confirmCallbackRef.current = callback || null
    setShowConfirmModal(true)
  }

  const handleRemoveRecent = (project) => {
    if (!isAllowed) {
      setMessage('권한이 없습니다. 허용된 계정으로 로그인해주세요.')
      return
    }

    // 모달만 표시하고, 실제 제거는 확인 버튼 클릭 시에만 실행
    const projectName = project.name
    
    showConfirm(
      `"${projectName}" 프로젝트를 최근 실행한 목록에서 제거하시겠습니까?`,
      async () => {
        try {
          await removeRecent(projectName)
          setMessage('최근 목록에서 제거되었습니다.')
          setTimeout(() => {
            setMessage('')
            loadProjects()
          }, 1000)
        } catch (error) {
          console.error('Error removing recent:', error)
          setMessage('최근 목록 제거에 실패했습니다.')
        }
      }
    )
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

  const handleSubcategoryToggle = (subcategoryName) => {
    setSelectedSubcategories(prev => {
      if (prev.includes(subcategoryName)) {
        return prev.filter(sub => sub !== subcategoryName)
      } else {
        return [...prev, subcategoryName]
      }
    })
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
        category: newProjectCategory,
        subcategory: newProjectSubcategory || null,
        color: newProjectColor || null,
        memo: newProjectMemo.trim() || null,
        jsonPath: enableJsonPath ? (newProjectJsonPath.trim() || null) : null
      })

      setMessage('프로젝트가 추가되었습니다.')
      // 카테고리는 유지하고 프로젝트명, 경로, 서브카테고리, 색상만 비우기
      setNewProjectName('')
      setNewProjectPath('')
      setNewProjectSubcategory('')
      setNewProjectColor('')
      setNewProjectMemo('')
      setNewProjectJsonPath('')
      setEnableJsonPath(false)
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
    setNewProjectSubcategory(project.subcategory || '')
    setNewProjectColor(project.color || '')
    setNewProjectMemo(project.memo || '')
    setNewProjectJsonPath(project.jsonPath || '.vscode/sftp.json')
    setEnableJsonPath(!!project.jsonPath)
    setShowEditModal(true)
  }

  const handleCancelEditProject = () => {
    setShowEditModal(false)
    setEditingProject(null)
    setNewProjectName('')
    setNewProjectPath('')
    setNewProjectCategory('')
    setNewProjectSubcategory('')
    setNewProjectColor('')
    setNewProjectMemo('')
    setNewProjectJsonPath('')
    setEnableJsonPath(false)
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
        category: newProjectCategory,
        subcategory: newProjectSubcategory || null,
        color: newProjectColor || null,
        memo: newProjectMemo.trim() || null,
        jsonPath: enableJsonPath ? (newProjectJsonPath.trim() || null) : null
      })

      setMessage('프로젝트가 수정되었습니다.')
      setShowEditModal(false)
      setEditingProject(null)
      setNewProjectName('')
      setNewProjectPath('')
      setNewProjectCategory('')
      setNewProjectSubcategory('')
      setNewProjectColor('')
      setNewProjectMemo('')
      setNewProjectJsonPath('')
      setEnableJsonPath(false)
      setTimeout(() => {
        setMessage('')
        loadProjects()
      }, 1000)
    } catch (error) {
      console.error('Error updating project:', error)
      setMessage('프로젝트 수정에 실패했습니다.')
    }
  }

  const handleDeleteProject = (project) => {
    if (!isAllowed) {
      setMessage('권한이 없습니다. 허용된 계정으로 로그인해주세요.')
      return
    }

    showConfirm(
      `"${project.name}" 프로젝트를 삭제하시겠습니까?`,
      async () => {
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
    )
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

  const handleAddSubcategory = async (e, categoryName) => {
    e.preventDefault()
    if (!isAllowed) {
      setMessage('권한이 없습니다. 허용된 계정으로 로그인해주세요.')
      return
    }
    if (!newSubcategoryName.trim()) {
      setMessage('서브카테고리명을 입력해주세요.')
      return
    }
    try {
      await addSubcategory(categoryName, newSubcategoryName.trim())
      setMessage('서브카테고리가 추가되었습니다.')
      setNewSubcategoryName('')
      setEditingCategoryForSub(null)
      loadProjects()
      setTimeout(() => setMessage(''), 2000)
    } catch (error) {
      console.error('Error adding subcategory:', error)
      setMessage('서브카테고리 추가에 실패했습니다: ' + (error.message || '알 수 없는 오류'))
    }
  }

  const handleEditSubcategory = (categoryName, subcategoryName) => {
    setEditingSubcategory({ categoryName, subcategoryName })
    setEditingSubcategoryName(subcategoryName)
  }

  const handleUpdateSubcategory = async (e, categoryName, oldSubcategoryName) => {
    e.preventDefault()
    if (!isAllowed) {
      setMessage('권한이 없습니다. 허용된 계정으로 로그인해주세요.')
      return
    }
    if (!editingSubcategoryName.trim()) {
      setMessage('서브카테고리명을 입력해주세요.')
      return
    }
    if (editingSubcategoryName.trim() === oldSubcategoryName) {
      setEditingSubcategory(null)
      setEditingSubcategoryName('')
      return
    }
    try {
      await updateSubcategory(categoryName, oldSubcategoryName, editingSubcategoryName.trim())
      setMessage('서브카테고리가 수정되었습니다.')
      setEditingSubcategory(null)
      setEditingSubcategoryName('')
      loadProjects()
      setTimeout(() => setMessage(''), 2000)
    } catch (error) {
      console.error('Error updating subcategory:', error)
      setMessage('서브카테고리 수정에 실패했습니다: ' + (error.message || '알 수 없는 오류'))
    }
  }

  const handleCancelEditSubcategory = () => {
    setEditingSubcategory(null)
    setEditingSubcategoryName('')
  }

  const handleDeleteSubcategory = (categoryName, subcategoryName) => {
    if (!isAllowed) {
      setMessage('권한이 없습니다. 허용된 계정으로 로그인해주세요.')
      return
    }
    showConfirm(
      `"${subcategoryName}" 서브카테고리를 삭제하시겠습니까?`,
      async () => {
        try {
          await deleteSubcategory(categoryName, subcategoryName)
          setMessage('서브카테고리가 삭제되었습니다.')
          loadProjects()
          setTimeout(() => setMessage(''), 2000)
        } catch (error) {
          console.error('Error deleting subcategory:', error)
          setMessage('서브카테고리 삭제에 실패했습니다.')
        }
      }
    )
  }

  const handleDragStart = (e, projectId) => {
    if (!sortMode) return
    // 타이머 클리어
    if (dragTimerRef.current) {
      clearTimeout(dragTimerRef.current)
      dragTimerRef.current = null
    }
    setDraggedProjectId(projectId)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/html', projectId)
    lastDragTargetRef.current = { projectId: null, insertPosition: null }
  }

  const handleDragOver = (e, projectId) => {
    if (!sortMode || !draggedProjectId || projectId === draggedProjectId) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    
    // 드래그 위치에 따라 삽입 위치 결정 (왼쪽/오른쪽)
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const width = rect.width
    const insertPosition = x < width / 2 ? 'left' : 'right' // 왼쪽 절반이면 'left', 오른쪽 절반이면 'right'
    
    // 타겟이나 위치가 변경되었을 때만 처리
    if (lastDragTargetRef.current.projectId !== projectId || 
        lastDragTargetRef.current.insertPosition !== insertPosition) {
      // 이전 타이머 클리어
      if (dragTimerRef.current) {
        clearTimeout(dragTimerRef.current)
        dragTimerRef.current = null
      }
      
      // 새로운 타겟 저장
      lastDragTargetRef.current = { projectId, insertPosition }
      setDraggedOverProjectId(projectId)
      
      // 0.5초 후 자동 업데이트
      dragTimerRef.current = setTimeout(() => {
        applyProjectReorder(projectId, insertPosition)
        dragTimerRef.current = null
      }, 500)
    }
  }

  // 프로젝트 순서 변경 함수 (전체 데이터베이스 기준)
  const applyProjectReorder = async (targetProjectId, insertPosition) => {
    if (!draggedProjectId || !targetProjectId || draggedProjectId === targetProjectId) {
      return
    }

    try {
      // 전체 데이터베이스에서 프로젝트 가져오기
      const allProjects = await getProjects()
      const sortedProjects = allProjects
        .map(p => ({ ...p }))
        .sort((a, b) => (a.number || 0) - (b.number || 0))
      
      const draggedIndex = sortedProjects.findIndex(p => p.id === draggedProjectId)
      const targetIndex = sortedProjects.findIndex(p => p.id === targetProjectId)
      
      if (draggedIndex === -1 || targetIndex === -1) return
      
      // 드래그한 프로젝트 제거
      const [draggedProject] = sortedProjects.splice(draggedIndex, 1)
      
      // 삽입 위치 결정 (draggedProject 제거 후 인덱스 조정)
      let insertIndex
      if (insertPosition === 'right') {
        if (draggedIndex < targetIndex) {
          insertIndex = targetIndex - 1 
        } else {
          insertIndex = targetIndex
        }
      } else {
        if (draggedIndex < targetIndex) {
          insertIndex = targetIndex
        } else {
          insertIndex = targetIndex + 1
        }
      }
      
      // 프로젝트 삽입
      sortedProjects.splice(insertIndex, 0, draggedProject)
      
      // 새로운 번호 할당 (전체 데이터베이스 기준)
      const projectsToUpdate = sortedProjects.map((project, index) => ({
        ...project,
        newNumber: index + 1
      }))
      
      // Firebase에 순서 업데이트 (변경된 프로젝트만)
      const updatePromises = projectsToUpdate
        .filter(p => p.number !== p.newNumber)
        .map(project => updateProject(project.id, { number: project.newNumber }))
      
      await Promise.all(updatePromises)
      loadProjects()
      setMessage('프로젝트 순서가 변경되었습니다.')
      setTimeout(() => setMessage(''), 2000)
    } catch (error) {
      console.error('Error reordering projects:', error)
      setMessage('프로젝트 순서 변경에 실패했습니다.')
    }
  }

  const handleDragLeave = () => {
    // 타이머 클리어
    if (dragTimerRef.current) {
      clearTimeout(dragTimerRef.current)
      dragTimerRef.current = null
    }
    setDraggedOverProjectId(null)
    lastDragTargetRef.current = { projectId: null, insertPosition: null }
  }

  const handleDrop = async (e, targetProjectId) => {
    e.preventDefault()
    
    // 타이머 클리어
    if (dragTimerRef.current) {
      clearTimeout(dragTimerRef.current)
      dragTimerRef.current = null
    }
    
    if (!sortMode || !draggedProjectId || draggedProjectId === targetProjectId) {
      setDraggedProjectId(null)
      setDraggedOverProjectId(null)
      lastDragTargetRef.current = { projectId: null, insertPosition: null }
      return
    }

    // 드롭 위치에 따라 삽입 위치 결정
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const width = rect.width
    const insertPosition = x < width / 2 ? 'left' : 'right'
    
    // 즉시 적용
    await applyProjectReorder(targetProjectId, insertPosition)
    
    // 상태 초기화
    setDraggedProjectId(null)
    setDraggedOverProjectId(null)
    lastDragTargetRef.current = { projectId: null, insertPosition: null }
  }

  const handleDragEnd = () => {
    // 타이머 클리어
    if (dragTimerRef.current) {
      clearTimeout(dragTimerRef.current)
      dragTimerRef.current = null
    }
    setDraggedProjectId(null)
    setDraggedOverProjectId(null)
    lastDragTargetRef.current = { projectId: null, insertPosition: null }
  }

  const toggleSortMode = () => {
    setSortMode(!sortMode)
    if (sortMode) {
      // 정렬 모드 종료 시 상태 초기화
      setDraggedProjectId(null)
      setDraggedOverProjectId(null)
    } else {
      // 정렬 모드 활성화 시 다른 모드 비활성화
      setCopyMode(false)
      setSelectedProjectsForCopy([])
      setDeleteMode(false)
      setSelectedProjectsForDelete([])
    }
  }

  const toggleCopyMode = () => {
    if (copyMode && selectedProjectsForCopy.length > 0) {
      // 복사 모드 종료 시 선택된 프로젝트가 있으면 복사 모달 표시
      setShowCopyModal(true)
    } else {
      // 복사 모드 토글
      setCopyMode(!copyMode)
      if (copyMode) {
        // 복사 모드 종료 시 선택 초기화
        setSelectedProjectsForCopy([])
      } else {
        // 복사 모드 활성화 시 삭제 모드 비활성화
        setDeleteMode(false)
        setSelectedProjectsForDelete([])
      }
    }
  }

  const toggleDeleteMode = () => {
    if (deleteMode && selectedProjectsForDelete.length > 0) {
      // 삭제 모드 종료 시 선택된 프로젝트가 있으면 확인 팝업 표시
      const projectNames = projects
        .filter(p => selectedProjectsForDelete.includes(p.id))
        .map(p => p.name)
        .join(', ')
      
      showConfirm(
        `선택한 ${selectedProjectsForDelete.length}개 프로젝트를 삭제하시겠습니까?\n\n${projectNames}`,
        async () => {
          await handleDeleteSelectedProjects()
        }
      )
    } else {
      // 삭제 모드 토글
      setDeleteMode(!deleteMode)
      if (deleteMode) {
        // 삭제 모드 종료 시 선택 초기화
        setSelectedProjectsForDelete([])
      } else {
        // 삭제 모드 활성화 시 복사 모드 비활성화
        setCopyMode(false)
        setSelectedProjectsForCopy([])
      }
    }
  }

  const handleDeleteSelectedProjects = async () => {
    if (!isAllowed) {
      setMessage('권한이 없습니다. 허용된 계정으로 로그인해주세요.')
      return
    }

    try {
      const projectsToDelete = projects.filter(p => selectedProjectsForDelete.includes(p.id))
      // 번호를 내림차순으로 정렬하여 큰 번호부터 삭제 (번호 재정렬이 올바르게 작동하도록)
      const sortedProjectsToDelete = [...projectsToDelete].sort((a, b) => (b.number || 0) - (a.number || 0))
      
      // 순차적으로 삭제 (번호 재정렬이 올바르게 작동하도록)
      for (const project of sortedProjectsToDelete) {
        await deleteProject(project.id)
      }
      
      setMessage(`${selectedProjectsForDelete.length}개 프로젝트가 삭제되었습니다.`)
      
      // 상태 초기화
      setDeleteMode(false)
      setSelectedProjectsForDelete([])
      
      // 프로젝트 목록 새로고침
      setTimeout(() => {
        setMessage('')
        loadProjects()
      }, 1000)
    } catch (error) {
      console.error('Error deleting projects:', error)
      setMessage('프로젝트 삭제에 실패했습니다.')
    }
  }

  const handleProjectCheck = (projectId) => {
    if (copyMode) {
      setSelectedProjectsForCopy(prev => {
        if (prev.includes(projectId)) {
          return prev.filter(id => id !== projectId)
        } else {
          return [...prev, projectId]
        }
      })
    } else if (deleteMode) {
      setSelectedProjectsForDelete(prev => {
        if (prev.includes(projectId)) {
          return prev.filter(id => id !== projectId)
        } else {
          return [...prev, projectId]
        }
      })
    }
  }

  // 현재 화면에 보이는 프로젝트 일괄 선택/해제
  const handleSelectAllVisible = (checked) => {
    const visibleProjectIds = filteredProjects.map(p => p.id)
    
    if (copyMode) {
      if (checked) {
        // 현재 선택된 것에 추가 (중복 제거)
        setSelectedProjectsForCopy(prev => {
          const combined = [...new Set([...prev, ...visibleProjectIds])]
          return combined
        })
      } else {
        // 현재 화면에 보이는 프로젝트들만 제거
        setSelectedProjectsForCopy(prev => prev.filter(id => !visibleProjectIds.includes(id)))
      }
    } else if (deleteMode) {
      if (checked) {
        // 현재 선택된 것에 추가 (중복 제거)
        setSelectedProjectsForDelete(prev => {
          const combined = [...new Set([...prev, ...visibleProjectIds])]
          return combined
        })
      } else {
        // 현재 화면에 보이는 프로젝트들만 제거
        setSelectedProjectsForDelete(prev => prev.filter(id => !visibleProjectIds.includes(id)))
      }
    }
  }

  // 현재 화면에 보이는 프로젝트가 모두 선택되었는지 확인
  const areAllVisibleSelected = () => {
    const visibleProjectIds = filteredProjects.map(p => p.id)
    if (visibleProjectIds.length === 0) return false
    
    if (copyMode) {
      return visibleProjectIds.every(id => selectedProjectsForCopy.includes(id))
    } else if (deleteMode) {
      return visibleProjectIds.every(id => selectedProjectsForDelete.includes(id))
    }
    return false
  }

  // 복사 모달에서 서브카테고리 수정 핸들러
  const handleCopyModalUpdateSubcategory = async (oldSubcategoryName) => {
    if (!copyEditingSubcategoryName.trim()) return
    try {
      await updateSubcategory(copyTargetCategory, oldSubcategoryName, copyEditingSubcategoryName.trim())
      setMessage('서브카테고리가 수정되었습니다.')
      const updatedCategories = await getCategories()
      setCategories(updatedCategories)
      setCopyEditingSubcategory(null)
      setCopyEditingSubcategoryName('')
      setTimeout(() => setMessage(''), 2000)
    } catch (error) {
      console.error('Error updating subcategory:', error)
      setMessage('서브카테고리 수정에 실패했습니다.')
    }
  }

  // 복사 모달에서 서브카테고리 추가 핸들러
  const handleCopyModalAddSubcategory = async () => {
    if (!copyNewSubcategoryName.trim()) return
    try {
      await addSubcategory(copyTargetCategory, copyNewSubcategoryName.trim())
      setMessage('서브카테고리가 추가되었습니다.')
      const updatedCategories = await getCategories()
      setCategories(updatedCategories)
      setCopyNewSubcategoryName('')
      setTimeout(() => setMessage(''), 2000)
    } catch (error) {
      console.error('Error adding subcategory:', error)
      setMessage('서브카테고리 추가에 실패했습니다.')
    }
  }

  const handleCopyProjects = async () => {
    if (!copyTargetCategory) {
      setMessage('대상 카테고리를 선택해주세요.')
      return
    }

    if (!isAllowed) {
      setMessage('권한이 없습니다. 허용된 계정으로 로그인해주세요.')
      return
    }

    try {
      const allProjects = await getProjects()
      const projectsToCopy = projects.filter(p => selectedProjectsForCopy.includes(p.id))
      // 대상 카테고리의 프로젝트 이름만 체크
      const existingProjectNames = allProjects
        .filter(p => p.category === copyTargetCategory)
        .map(p => p.name)
      
      const copiedProjects = []
      const skippedProjects = []

      for (const project of projectsToCopy) {
        if (existingProjectNames.includes(project.name)) {
          skippedProjects.push(project.name)
          continue
        }

        // 프로젝트 복사 (addProject가 자동으로 번호 할당)
        await addProject({
          name: project.name,
          path: project.path,
          category: copyTargetCategory,
          subcategory: copyTargetSubcategory || null,
          color: project.color || null
        })

        copiedProjects.push(project.name)
        existingProjectNames.push(project.name) // 중복 체크를 위해 추가
      }

      // 결과 메시지 표시
      let resultMessage = ''
      if (copiedProjects.length > 0) {
        resultMessage = `${copiedProjects.length}개 프로젝트가 복사되었습니다: ${copiedProjects.join(', ')}`
      }
      if (skippedProjects.length > 0) {
        resultMessage += `\n\n이미 존재하는 프로젝트는 제외되었습니다 (${skippedProjects.length}개): ${skippedProjects.join(', ')}`
      }

      setMessage(resultMessage || '복사할 프로젝트가 없습니다.')
      
      // 상태 초기화
      setCopyMode(false)
      setSelectedProjectsForCopy([])
      setShowCopyModal(false)
      setCopyTargetCategory('')
      setCopyTargetSubcategory('')
      
      // 프로젝트 목록 새로고침
      setTimeout(() => {
        setMessage('')
        loadProjects()
      }, 3000)
    } catch (error) {
      console.error('Error copying projects:', error)
      setMessage('프로젝트 복사에 실패했습니다.')
    }
  }

  // 메모 보기 핸들러
  const handleViewMemo = (project) => {
    setMemoProject(project)
    setShowMemoModal(true)
  }

  // 폴더 열기 핸들러
  const openFolderInProgress = useRef(false)
  const handleOpenFolder = async (project) => {
    if (openFolderInProgress.current) return
    openFolderInProgress.current = true
    setTimeout(() => { openFolderInProgress.current = false }, 1000)
    if (!isAllowed) {
      setMessage('권한이 없습니다. 허용된 계정으로 로그인해주세요.')
      return
    }

    try {
      // API URL 설정
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'
      
      // 백엔드 API 호출
      const response = await fetch(`${apiUrl}/api/open-folder`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectPath: project.path,
        }),
      })

      if (response.ok) {
        setMessage(`${project.name} 폴더가 열렸습니다.`)
      } else if (response.status === 404) {
        setMessage(`폴더를 찾을 수 없습니다.\n경로: ${project.path}`)
      } else {
        const data = await response.json().catch(() => ({}))
        setMessage(`폴더 열기 실패: ${data.error || '알 수 없는 오류'}`)
      }
    } catch (error) {
      // fetch 자체가 실패한 경우 = 서버 미실행
      console.warn('백엔드 서버에 연결할 수 없습니다.', error)
      try {
        await navigator.clipboard.writeText(project.path)
        setMessage(`백엔드 서버가 실행 중이 아닙니다.\n경로가 클립보드에 복사되었습니다.\n${project.path}`)
      } catch (clipboardError) {
        setMessage(`백엔드 서버가 실행 중이 아닙니다.\n경로: ${project.path}`)
      }
    }
  }

  // JSON 파일 열기 핸들러
  const handleOpenJsonFile = async (project) => {
    if (!isAllowed) {
      setMessage('권한이 없습니다. 허용된 계정으로 로그인해주세요.')
      return
    }

    if (!project.jsonPath) {
      setMessage('JSON 파일 경로가 설정되지 않았습니다.')
      return
    }

    try {
      // API URL 설정
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'
      
      // 백엔드 API 호출
      const response = await fetch(`${apiUrl}/api/open-json`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectPath: project.path,
          jsonPath: project.jsonPath,
        }),
      })

      if (response.ok) {
        setMessage(`${project.jsonPath} 파일이 열렸습니다.`)
      } else {
        throw new Error('API 응답 오류')
      }
    } catch (error) {
      console.warn('백엔드 서버에 연결할 수 없습니다.', error)
      const fullPath = `${project.path}/${project.jsonPath.replace(/^[\/\\]/, '')}`
      try {
        await navigator.clipboard.writeText(fullPath)
        setMessage(`파일 경로가 클립보드에 복사되었습니다.\n\n백엔드 서버가 실행 중이 아닙니다. 직접 파일을 열어주세요.\n경로: ${fullPath}`)
      } catch (clipboardError) {
        setMessage(`파일 경로: ${fullPath}\n\n백엔드 서버가 실행 중이 아닙니다. 직접 파일을 열어주세요.`)
      }
    }
  }

  // 카테고리 설정 모달 열기
  const handleCategorySettings = (categoryName) => {
    setSelectedCategoryForSettings(categoryName)
    setShowCategorySettingsModal(true)
  }

  // 카테고리의 SFTP 플러그인 사용 여부 확인
  const isSftpEnabledForCategory = (categoryName) => {
    const categoryData = categories.find(c => {
      const catName = typeof c === 'string' ? c : c.name
      return catName === categoryName
    })
    return (categoryData && typeof categoryData !== 'string' && categoryData.settings) 
      ? categoryData.settings.useSftpPlugin || false
      : false
  }

  // 카테고리 설정 저장
  const handleSaveCategorySettings = async (categoryName, settings) => {
    try {
      await updateCategorySettings(categoryName, settings)
      setMessage('카테고리 설정이 저장되었습니다.')
      setShowCategorySettingsModal(false)
      await loadProjects()
      setTimeout(() => setMessage(''), 2000)
    } catch (error) {
      console.error('Error saving category settings:', error)
      setMessage('카테고리 설정 저장에 실패했습니다.')
    }
  }

  const handleDeleteCategory = (categoryName) => {
    if (!isAllowed) {
      setMessage('권한이 없습니다. 허용된 계정으로 로그인해주세요.')
      return
    }

    showConfirm(
      `"${categoryName}" 카테고리를 삭제하시겠습니까?`,
      async () => {
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
    )
  }

  const filteredProjects = (selectedCategory
    ? projects.filter(p => p.category === selectedCategory)
    : projects
  ).filter(p => {
    // 서브카테고리 필터 적용
    // 선택된 카테고리의 서브카테고리 목록 가져오기
    const selectedCat = categories.find(c => {
      const catName = typeof c === 'string' ? c : c.name
      return catName === selectedCategory
    })
    const availableSubcategories = selectedCat && typeof selectedCat !== 'string' ? (selectedCat.subcategories || []) : []
    
    // 서브카테고리가 없는 카테고리면 모든 프로젝트 표시
    if (availableSubcategories.length === 0) {
      return true
    }
    
    // 선택된 서브카테고리가 없으면 아무것도 표시하지 않음
    if (selectedSubcategories.length === 0) {
      return false
    }
    
    // 서브카테고리가 없는 프로젝트 처리
    if (!p.subcategory) {
      // "서브카테고리 없음"이 선택되어 있으면 표시
      return selectedSubcategories.includes(null)
    }
    
    // 선택된 서브카테고리에 포함된 프로젝트만 표시
    return selectedSubcategories.includes(p.subcategory)
  })

  // Recent 프로젝트를 recent 배열의 순서대로 정렬 (가장 최근 것이 먼저)
  const recentProjects = recent
    .map(name => filteredProjects.find(p => p.name === name))
    .filter(Boolean) // undefined 제거
  
  const favoriteProjects = filteredProjects.filter(p => favorites.includes(p.name))

  // 선택된 카테고리의 색상 가져오기
  const selectedCategoryData = categories.find(c => (c.name || c) === selectedCategory)
  const selectedCategoryColor = selectedCategoryData 
    ? (typeof selectedCategoryData === 'string' ? '#667eea' : (selectedCategoryData.color || '#667eea'))
    : '#667eea'

  // 선택된 카테고리의 기본 에디터 가져오기
  const selectedCategoryEditor = (selectedCategoryData && typeof selectedCategoryData !== 'string' && selectedCategoryData.settings)
    ? selectedCategoryData.settings.defaultEditor || 'cursor'
    : 'cursor'

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
          <div className="loading"><span>로딩 중...</span></div>
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
          <h1 className="title">
            {selectedCategoryEditor === 'vscode' ? 'VSCode Launcher' : 'Cursor Launcher'}
          </h1>
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
                        // 상태 초기화
                        setEditingProject(null)
                        setNewProjectName('')
                        setNewProjectPath('')
                        setNewProjectColor('')
                        setNewProjectMemo('')
                        setNewProjectJsonPath('')
                        setEnableJsonPath(false)
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
                onClick={() => {
                  setSelectedCategory(categoryName)
                  localStorage.setItem('selectedCategory', categoryName)
                  // 카테고리 변경 시 해당 카테고리의 모든 서브카테고리를 기본값으로 선택
                  const selectedCat = categories.find(c => {
                    const catName = typeof c === 'string' ? c : c.name
                    return catName === categoryName
                  })
                  const subcategories = selectedCat && typeof selectedCat !== 'string' ? (selectedCat.subcategories || []) : []
                  setSelectedSubcategories([...subcategories, null]) // 모든 서브카테고리와 "서브카테고리 없음"을 기본값으로 선택
                }}
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
          {/* 서브카테고리 필터 */}
          {selectedCategory && (() => {
            const selectedCat = categories.find(c => {
              const catName = typeof c === 'string' ? c : c.name
              return catName === selectedCategory
            })
            const subcategories = selectedCat && typeof selectedCat !== 'string' ? (selectedCat.subcategories || []) : []
            return subcategories.length > 0 && (
              <>
                {subcategories.map(sub => (
                  <label key={sub} className="checkbox-label checkbox-label--sub-category">
                    <input
                      type="checkbox"
                      checked={selectedSubcategories.includes(sub)}
                      onChange={() => handleSubcategoryToggle(sub)}
                    />
                    <span>
                      <FaCheck className="checkbox-icon" />
                      {sub}
                    </span>
                  </label>
                ))}
                {/* 서브카테고리 없음 체크박스 */}
                <label className="checkbox-label checkbox-label--sub-category">
                  <input
                    type="checkbox"
                    checked={selectedSubcategories.includes(null)}
                    onChange={() => handleSubcategoryToggle(null)}
                  />
                  <span>
                    <FaCheck className="checkbox-icon" />
                    No Category
                  </span>
                </label>
              </>
            )
          })()}
        </div>

        {/* 프로젝트 추가 모달 */}
        {showAddModal && (
          <div className="modal-overlay">
            <div className="modal-inner">
              <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>프로젝트 추가</h2>
                <button 
                  className="close-btn"
                  onClick={() => {
                    setNewProjectName('')
                    setNewProjectPath('')
                    setNewProjectColor('')
                    setNewProjectMemo('')
                    setNewProjectJsonPath('')
                    setEnableJsonPath(false)
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
                      onChange={(e) => {
                        setNewProjectCategory(e.target.value)
                        setNewProjectSubcategory('') // 카테고리 변경 시 서브카테고리 초기화
                        
                        // SFTP 플러그인을 사용하지 않는 카테고리로 변경 시 JSON 경로 초기화
                        if (!isSftpEnabledForCategory(e.target.value)) {
                          setEnableJsonPath(false)
                          setNewProjectJsonPath('')
                        }
                      }}
                    >
                      {categories.map(cat => {
                        const catName = typeof cat === 'string' ? cat : cat.name
                        return <option key={catName} value={catName}>{catName}</option>
                      })}
                    </select>
                    <FaChevronDown className="select-arrow" />
                  </div>
                </div>
                {newProjectCategory && (() => {
                  const selectedCat = categories.find(c => {
                    const catName = typeof c === 'string' ? c : c.name
                    return catName === newProjectCategory
                  })
                  const subcategories = selectedCat && typeof selectedCat !== 'string' ? (selectedCat.subcategories || []) : []
                  return subcategories.length > 0 && (
                    <div className="form-group">
                      <label>서브카테고리 (선택사항)</label>
                      <div className="select-wrapper">
                        <select
                          value={newProjectSubcategory}
                          onChange={(e) => setNewProjectSubcategory(e.target.value)}
                        >
                          <option value="">없음</option>
                          {subcategories.map(sub => (
                            <option key={sub} value={sub}>{sub}</option>
                          ))}
                        </select>
                        <FaChevronDown className="select-arrow" />
                      </div>
                    </div>
                  )
                })()}
                <div className="form-group">
                  <label>프로젝트 색상 (선택사항)</label>
                  <div className="color-input-wrapper">
                    <input
                      type="color"
                      value={newProjectColor || selectedCategoryColor}
                      onChange={(e) => setNewProjectColor(e.target.value)}
                      className="color-picker"
                      title="색상 선택"
                    />
                    <input
                      type="text"
                      value={newProjectColor || ''}
                      onChange={(e) => setNewProjectColor(e.target.value)}
                      placeholder={selectedCategoryColor}
                      className="color-text-input"
                      pattern="^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$"
                    />
                    {newProjectColor && (
                      <button
                        type="button"
                        onClick={() => setNewProjectColor('')}
                        className="color-clear-btn"
                        title="색상 제거"
                      >
                        <FaTimes />
                      </button>
                    )}
                  </div>
                  <p className="form-help-text">색상을 지정하지 않으면 카테고리의 테마 색상이 사용됩니다.</p>
                </div>
                <div className="form-group">
                  <label>메모 (선택사항)</label>
                  <textarea
                    value={newProjectMemo}
                    onChange={(e) => setNewProjectMemo(e.target.value)}
                    placeholder="프로젝트에 대한 메모를 입력하세요..."
                    rows={4}
                    style={{ resize: 'vertical', fontFamily: 'inherit' }}
                  />
                  <p className="form-help-text">메모를 입력하면 프로젝트 카드에 메모 보기 버튼이 표시됩니다.</p>
                </div>
                {/* SFTP 플러그인을 사용하는 카테고리에서만 표시 */}
                {isSftpEnabledForCategory(newProjectCategory) && (
                  <div className="form-group">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={enableJsonPath}
                        onChange={(e) => {
                          setEnableJsonPath(e.target.checked)
                          if (e.target.checked && !newProjectJsonPath) {
                            setNewProjectJsonPath('.vscode/sftp.json')
                          }
                        }}
                      />
                      <span>
                        <FaCheck className="checkbox-icon" />
                        sftp.json 사용
                      </span>
                    </label>
                    {enableJsonPath && (
                      <input
                        type="text"
                        value={newProjectJsonPath}
                        onChange={(e) => setNewProjectJsonPath(e.target.value)}
                        placeholder="예: .vscode/sftp.json"
                        style={{ marginTop: '0.5rem' }}
                      />
                    )}
                  </div>
                )}
                <div className="form-actions">
                  <button 
                    type="button" 
                    onClick={() => {
                      setNewProjectName('')
                      setNewProjectPath('')
                      setNewProjectSubcategory('')
                      setNewProjectColor('')
                      setNewProjectMemo('')
                      setNewProjectJsonPath('')
                      setEnableJsonPath(false)
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
          </div>
        )}

        {/* 프로젝트 수정 모달 */}
        {showEditModal && editingProject && (
          <div className="modal-overlay">
            <div className="modal-inner">
              <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>프로젝트 수정</h2>
                <button 
                  className="close-btn"
                  onClick={handleCancelEditProject}
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
                      onChange={(e) => {
                        setNewProjectCategory(e.target.value)
                        setNewProjectSubcategory('') // 카테고리 변경 시 서브카테고리 초기화
                        
                        // SFTP 플러그인을 사용하지 않는 카테고리로 변경 시 JSON 경로 초기화
                        if (!isSftpEnabledForCategory(e.target.value)) {
                          setEnableJsonPath(false)
                          setNewProjectJsonPath('')
                        }
                      }}
                    >
                      {categories.map(cat => {
                        const catName = typeof cat === 'string' ? cat : cat.name
                        return <option key={catName} value={catName}>{catName}</option>
                      })}
                    </select>
                    <FaChevronDown className="select-arrow" />
                  </div>
                </div>
                {newProjectCategory && (() => {
                  const selectedCat = categories.find(c => {
                    const catName = typeof c === 'string' ? c : c.name
                    return catName === newProjectCategory
                  })
                  const subcategories = selectedCat && typeof selectedCat !== 'string' ? (selectedCat.subcategories || []) : []
                  return subcategories.length > 0 && (
                    <div className="form-group">
                      <label>서브카테고리 (선택사항)</label>
                      <div className="select-wrapper">
                        <select
                          value={newProjectSubcategory}
                          onChange={(e) => setNewProjectSubcategory(e.target.value)}
                        >
                          <option value="">없음</option>
                          {subcategories.map(sub => (
                            <option key={sub} value={sub}>{sub}</option>
                          ))}
                        </select>
                        <FaChevronDown className="select-arrow" />
                      </div>
                    </div>
                  )
                })()}
                <div className="form-group">
                  <label>프로젝트 색상 (선택사항)</label>
                  <div className="color-input-wrapper">
                    {(() => {
                      const addModalCategory = categories.find(c => {
                        const catName = typeof c === 'string' ? c : c.name
                        return catName === newProjectCategory
                      })
                      const addModalCategoryColor = addModalCategory 
                        ? (typeof addModalCategory === 'string' ? '#667eea' : (addModalCategory.color || '#667eea'))
                        : '#667eea'
                      return (
                        <>
                          <input
                            type="color"
                            value={newProjectColor || addModalCategoryColor}
                            onChange={(e) => setNewProjectColor(e.target.value)}
                            className="color-picker"
                            title="색상 선택"
                          />
                          <input
                            type="text"
                            value={newProjectColor || ''}
                            onChange={(e) => setNewProjectColor(e.target.value)}
                            placeholder={addModalCategoryColor}
                            className="color-text-input"
                            pattern="^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$"
                          />
                        </>
                      )
                    })()}
                    {newProjectColor && (
                      <button
                        type="button"
                        onClick={() => setNewProjectColor('')}
                        className="color-clear-btn"
                        title="색상 제거"
                      >
                        <FaTimes />
                      </button>
                    )}
                  </div>
                  <p className="form-help-text">색상을 지정하지 않으면 카테고리의 테마 색상이 사용됩니다.</p>
                </div>
                <div className="form-group">
                  <label>메모 (선택사항)</label>
                  <textarea
                    value={newProjectMemo}
                    onChange={(e) => setNewProjectMemo(e.target.value)}
                    placeholder="프로젝트에 대한 메모를 입력하세요..."
                    rows={4}
                    style={{ resize: 'vertical', fontFamily: 'inherit' }}
                  />
                  <p className="form-help-text">메모를 입력하면 프로젝트 카드에 메모 보기 버튼이 표시됩니다.</p>
                </div>
                {/* SFTP 플러그인을 사용하는 카테고리에서만 표시 */}
                {isSftpEnabledForCategory(newProjectCategory) && (
                  <div className="form-group">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={enableJsonPath}
                        onChange={(e) => {
                          setEnableJsonPath(e.target.checked)
                          if (e.target.checked && !newProjectJsonPath) {
                            setNewProjectJsonPath('.vscode/sftp.json')
                          }
                        }}
                      />
                      <span>
                        <FaCheck className="checkbox-icon" />
                        sftp.json 사용
                      </span>
                    </label>
                    {enableJsonPath && (
                      <input
                        type="text"
                        value={newProjectJsonPath}
                        onChange={(e) => setNewProjectJsonPath(e.target.value)}
                        placeholder="예: .vscode/sftp.json"
                        style={{ marginTop: '0.5rem' }}
                      />
                    )}
                  </div>
                )}
                <div className="form-actions">
                  <button type="button" onClick={handleCancelEditProject}>
                    취소
                  </button>
                  <button type="submit">수정</button>
                </div>
              </form>
              </div>
            </div>
          </div>
        )}

        {/* 카테고리 관리 모달 */}
        {showCategoryModal && (
          <div className="modal-overlay" onClick={() => setShowCategoryModal(false)}>
            <div className="modal-inner">
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
                          <div className="category-main">
                          <div className="category-info">
                            <span 
                              className="category-color-indicator"
                              style={{ backgroundColor: categoryColor }}
                            ></span>
                            <span>{categoryName}</span>
                          </div>
                          <div className="category-actions">
                            <button
                              className="settings-btn"
                              onClick={() => handleCategorySettings(categoryName)}
                              title="카테고리 설정"
                            >
                              <FaCog />
                            </button>
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
                          </div>
                          {/* 서브카테고리 목록 및 추가 */}
                          <div className="subcategories-section">
                            {(() => {
                              const subcategories = typeof category !== 'string' ? (category.subcategories || []) : []
                              return (
                                <>
                                  {subcategories.length > 0 && (
                                    <div className="subcategories-list">
                                      {subcategories.map(sub => {
                                        const isEditing = editingSubcategory?.categoryName === categoryName && editingSubcategory?.subcategoryName === sub
                                        return (
                                          <div key={sub} className="subcategory-item">
                                            {isEditing ? (
                                              <form 
                                                className="subcategory-edit-form"
                                                onSubmit={(e) => handleUpdateSubcategory(e, categoryName, sub)}
                                              >
                                                <input
                                                  type="text"
                                                  value={editingSubcategoryName}
                                                  onChange={(e) => setEditingSubcategoryName(e.target.value)}
                                                  autoFocus
                                                  className="subcategory-edit-input"
                                                />
                                                <button type="submit" className="save-btn" title="저장">
                                                  <FaCheck />
                                                </button>
                                                <button 
                                                  type="button" 
                                                  onClick={handleCancelEditSubcategory} 
                                                  className="cancel-btn"
                                                  title="취소"
                                                >
                                                  <FaTimes />
                                                </button>
                                              </form>
                                            ) : (
                                              <>
                                                <span className="subcategory-name">{sub}</span>
                                                <div className="subcategory-actions">
                                                  <button
                                                    className="edit-btn"
                                                    onClick={() => handleEditSubcategory(categoryName, sub)}
                                                    title="수정"
                                                  >
                                                    <FaEdit />
                                                  </button>
                                                  <button
                                                    className="delete-btn"
                                                    onClick={() => handleDeleteSubcategory(categoryName, sub)}
                                                    title="서브카테고리 삭제"
                                                  >
                                                    <FaTimes />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
                                  )}
                                  <form 
                                    className="subcategory-add-form"
                                    onSubmit={(e) => handleAddSubcategory(e, categoryName)}
                                  >
                                    <input
                                      type="text"
                                      value={editingCategoryForSub === categoryName ? newSubcategoryName : ''}
                                      onChange={(e) => setNewSubcategoryName(e.target.value)}
                                      onFocus={() => setEditingCategoryForSub(categoryName)}
                                      onBlur={(e) => {
                                        // submit 버튼 클릭 시에는 blur 무시
                                        if (e.relatedTarget && e.relatedTarget.type === 'submit') {
                                          return
                                        }
                                        setTimeout(() => {
                                          if (editingCategoryForSub === categoryName && !newSubcategoryName.trim()) {
                                            setEditingCategoryForSub(null)
                                            setNewSubcategoryName('')
                                          }
                                        }, 200)
                                      }}
                                      placeholder="서브카테고리 추가..."
                                      className="subcategory-input"
                                    />
                                    {editingCategoryForSub === categoryName && newSubcategoryName.trim() && (
                                      <button type="submit" className="add-btn-small" title="추가">
                                        <FaPlus />
                                      </button>
                                    )}
                                  </form>
                                </>
                              )
                            })()}
                          </div>
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
              </div>
            </div>
          </div>
        )}

        {showCopyModal && (
          <div className="modal-overlay" onClick={() => {
            setShowCopyModal(false)
            setCopyTargetCategory('')
            setCopyTargetSubcategory('')
            setCopyNewSubcategoryName('')
            setCopyEditingSubcategory(null)
            setCopyEditingSubcategoryName('')
          }}>
            <div className="modal-inner">
              <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>프로젝트 복사</h2>
                <button
                  className="close-btn"
                  onClick={() => {
                    setShowCopyModal(false)
                    setCopyTargetCategory('')
                    setCopyTargetSubcategory('')
                    setCopyNewSubcategoryName('')
                    setCopyEditingSubcategory(null)
                    setCopyEditingSubcategoryName('')
                  }}
                >
                  <FaTimes />
                </button>
              </div>
              <form onSubmit={(e) => {
                e.preventDefault()
                handleCopyProjects()
              }}>
                <div className="form-group">
                  <label>대상 카테고리 *</label>
                  <div className="select-wrapper">
                    <select
                      value={copyTargetCategory}
                      onChange={(e) => {
                        setCopyTargetCategory(e.target.value)
                        setCopyTargetSubcategory('')
                      }}
                      required
                    >
                      <option value="">선택하세요</option>
                      {categories.map(cat => {
                        const catName = typeof cat === 'string' ? cat : cat.name
                        return <option key={catName} value={catName}>{catName}</option>
                      })}
                    </select>
                    <FaChevronDown className="select-arrow" />
                  </div>
                </div>
                {copyTargetCategory && (() => {
                  const selectedCat = categories.find(c => {
                    const catName = typeof c === 'string' ? c : c.name
                    return catName === copyTargetCategory
                  })
                  const subcategories = selectedCat && typeof selectedCat !== 'string' ? (selectedCat.subcategories || []) : []
                  return (
                    <div className="form-group">
                      <label>서브카테고리 (선택사항)</label>
                      <div className="select-wrapper">
                        <select
                          value={copyTargetSubcategory}
                          onChange={(e) => setCopyTargetSubcategory(e.target.value)}
                        >
                          <option value="">없음</option>
                          {subcategories.map(sub => (
                            <option key={sub} value={sub}>{sub}</option>
                          ))}
                        </select>
                        <FaChevronDown className="select-arrow" />
                      </div>
                      <div className="subcategories-section">
                        {subcategories.length > 0 && (
                          <div className="subcategories-list">
                            {subcategories.map((sub) => {
                              const isEditing = copyEditingSubcategory === sub
                              return (
                                <div key={sub} className="subcategory-item">
                                  {isEditing ? (
                                    <div
                                      className="subcategory-edit-form"
                                    >
                                      <input
                                        type="text"
                                        value={copyEditingSubcategoryName}
                                        onChange={(e) => setCopyEditingSubcategoryName(e.target.value)}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') {
                                            e.preventDefault()
                                            e.stopPropagation()
                                            if (!copyEditingSubcategoryName.trim()) return
                                            handleCopyModalUpdateSubcategory(sub)
                                          }
                                        }}
                                        className="subcategory-edit-input"
                                        autoFocus
                                      />
                                      <button 
                                        type="button"
                                        className="add-btn-small" 
                                        title="저장"
                                        onClick={async (e) => {
                                          e.preventDefault()
                                          e.stopPropagation()
                                          if (!copyEditingSubcategoryName.trim()) return
                                          await handleCopyModalUpdateSubcategory(sub)
                                        }}
                                      >
                                        <FaCheck />
                                      </button>
                                      <button
                                        type="button"
                                        className="delete-btn"
                                        onClick={(e) => {
                                          e.preventDefault()
                                          e.stopPropagation()
                                          setCopyEditingSubcategory(null)
                                          setCopyEditingSubcategoryName('')
                                        }}
                                        title="취소"
                                      >
                                        <FaTimes />
                                      </button>
                                    </div>
                                  ) : (
                                    <>
                                      <span className="subcategory-name">{sub}</span>
                                      <div className="subcategory-actions">
                                        <button
                                          className="edit-btn"
                                          onClick={() => {
                                            setCopyEditingSubcategory(sub)
                                            setCopyEditingSubcategoryName(sub)
                                          }}
                                          title="수정"
                                        >
                                          <FaEdit />
                                        </button>
                                         <button
                                           className="delete-btn"
                                           onClick={() => {
                                             showConfirm(
                                               `"${sub}" 서브카테고리를 삭제하시겠습니까?`,
                                               async () => {
                                                 try {
                                                   await deleteSubcategory(copyTargetCategory, sub)
                                                   setMessage('서브카테고리가 삭제되었습니다.')
                                                   const updatedCategories = await getCategories()
                                                   setCategories(updatedCategories)
                                                   if (copyTargetSubcategory === sub) {
                                                     setCopyTargetSubcategory('')
                                                   }
                                                   setTimeout(() => setMessage(''), 2000)
                                                 } catch (error) {
                                                   console.error('Error deleting subcategory:', error)
                                                   setMessage('서브카테고리 삭제에 실패했습니다.')
                                                 }
                                               }
                                             )
                                           }}
                                           title="서브카테고리 삭제"
                                         >
                                           <FaTimes />
                                         </button>
                                      </div>
                                    </>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )}
                        <div
                          className="subcategory-add-form"
                        >
                          <input
                            type="text"
                            value={copyNewSubcategoryName}
                            onChange={(e) => setCopyNewSubcategoryName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault()
                                e.stopPropagation()
                                handleCopyModalAddSubcategory()
                              }
                            }}
                            placeholder="서브카테고리 추가..."
                            className="subcategory-input"
                          />
                          {copyNewSubcategoryName.trim() && (
                            <button 
                              type="button"
                              className="add-btn-small" 
                              title="추가"
                              onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                handleCopyModalAddSubcategory()
                              }}
                            >
                              <FaPlus />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })()}
                <div className="form-actions">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCopyModal(false)
                      setCopyTargetCategory('')
                      setCopyTargetSubcategory('')
                      setCopyNewSubcategoryName('')
                      setCopyEditingSubcategory(null)
                      setCopyEditingSubcategoryName('')
                    }}
                  >
                    취소
                  </button>
                  <button type="submit">복사 실행</button>
                </div>
              </form>
              </div>
            </div>
          </div>
        )}

        {showConfirmModal && (
          <div className="modal-overlay" onClick={() => {
            setShowConfirmModal(false)
            setConfirmMessage('')
            confirmCallbackRef.current = null
          }}>
            <div className="modal-inner">
              <div className="modal-content confirm-modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>확인</h2>
                <button
                  className="close-btn"
                  onClick={() => {
                    setShowConfirmModal(false)
                    setConfirmMessage('')
                    confirmCallbackRef.current = null
                  }}
                >
                  <FaTimes />
                </button>
              </div>
              <div className="confirm-message">
                <p>{confirmMessage}</p>
              </div>
              <div className="form-actions">
                <button
                  type="button"
                  onClick={() => {
                    setShowConfirmModal(false)
                    setConfirmMessage('')
                    confirmCallbackRef.current = null
                  }}
                  className="cancel-btn"
                >
                  취소
                </button>
                {confirmCallbackRef.current && (
                  <button
                    type="button"
                    onClick={async (e) => {
                      e.stopPropagation()
                      const callback = confirmCallbackRef.current
                      if (typeof callback === 'function') {
                        await callback()
                      }
                      setShowConfirmModal(false)
                      setConfirmMessage('')
                      confirmCallbackRef.current = null
                    }}
                    className="confirm-btn"
                  >
                    확인
                  </button>
                )}
              </div>
              </div>
            </div>
          </div>
        )}

        {/* 메모 모달 */}
        {showMemoModal && memoProject && (
          <div className="modal-overlay" onClick={() => {
            setShowMemoModal(false)
            setMemoProject(null)
          }}>
            <div className="modal-inner">
              <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>{memoProject.name} - 메모</h2>
                <button
                  className="close-btn"
                  onClick={() => {
                    setShowMemoModal(false)
                    setMemoProject(null)
                  }}
                >
                  <FaTimes />
                </button>
              </div>
              <div className="memo-content">
                <pre style={{ 
                  whiteSpace: 'pre-wrap', 
                  fontFamily: 'inherit', 
                  margin: 0, 
                  padding: '1rem',
                  backgroundColor: '#f5f5f5',
                  borderRadius: '4px',
                  minHeight: '100px'
                }}>
                  {memoProject.memo || '메모가 없습니다.'}
                </pre>
              </div>
              <div className="form-actions">
                <button
                  type="button"
                  onClick={() => {
                    setShowMemoModal(false)
                    setMemoProject(null)
                  }}
                >
                  닫기
                </button>
              </div>
              </div>
            </div>
          </div>
        )}

        {/* 카테고리 설정 모달 */}
        {showCategorySettingsModal && selectedCategoryForSettings && (
          <div className="modal-overlay" onClick={() => {
            setShowCategorySettingsModal(false)
            setSelectedCategoryForSettings(null)
          }}>
            <div className="modal-inner">
              <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                  <h2>{selectedCategoryForSettings} - 카테고리 설정</h2>
                  <button
                    className="close-btn"
                    onClick={() => {
                      setShowCategorySettingsModal(false)
                      setSelectedCategoryForSettings(null)
                    }}
                  >
                    <FaTimes />
                  </button>
                </div>
                <CategorySettings
                  categoryName={selectedCategoryForSettings}
                  categories={categories}
                  onSave={handleSaveCategorySettings}
                  onCancel={() => {
                    setShowCategorySettingsModal(false)
                    setSelectedCategoryForSettings(null)
                  }}
                />
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
                  categories={categories}
                  onOpen={handleOpenProject}
                  onToggleFavorite={handleToggleFavorite}
                  onEdit={handleEditProject}
                  onDelete={handleDeleteProject}
                  onRemoveRecent={handleRemoveRecent}
                  onViewMemo={handleViewMemo}
                  onOpenFolder={handleOpenFolder}
                  onOpenJsonFile={handleOpenJsonFile}
                  isRecent={true}
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
                  categories={categories}
                  onOpen={handleOpenProject}
                  onToggleFavorite={handleToggleFavorite}
                  onEdit={handleEditProject}
                  onDelete={handleDeleteProject}
                  onViewMemo={handleViewMemo}
                  onOpenFolder={handleOpenFolder}
                  onOpenJsonFile={handleOpenJsonFile}
                  isAllowed={isAllowed}
                />
              ))}
            </div>
          </section>
        )}

        <section className="section">
          <div className="section-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {(copyMode || deleteMode) && isAllowed && filteredProjects.length > 0 && (
                <label className="checkbox-label" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={areAllVisibleSelected()}
                    onChange={(e) => handleSelectAllVisible(e.target.checked)}
                  />
                  <span>
                    <FaCheck className="checkbox-icon" />
                  </span>
                </label>
              )}
          <h2 className="section-title">All Projects</h2>
            </div>
            {isAllowed && filteredProjects.length > 0 && (
              <div className="section-header-buttons">
                <button
                  className={`copy-mode-btn ${copyMode ? 'active' : ''}`}
                  onClick={toggleCopyMode}
                  title={copyMode ? (selectedProjectsForCopy.length > 0 ? '복사 실행' : '복사 모드 종료') : '프로젝트 복사 모드'}
                  style={{ color: copyMode ? '#4caf50' : selectedCategoryColor }}
                >
                  <FaCopy />
                </button>
                <button
                  className={`delete-mode-btn ${deleteMode ? 'active' : ''}`}
                  onClick={toggleDeleteMode}
                  title={deleteMode ? (selectedProjectsForDelete.length > 0 ? '삭제 실행' : '삭제 모드 종료') : '프로젝트 삭제 모드'}
                  style={{ color: deleteMode ? '#f44336' : selectedCategoryColor }}
                >
                  <FaTrash />
                </button>
                <button
                  className={`sort-mode-btn ${sortMode ? 'active' : ''}`}
                  onClick={toggleSortMode}
                  title={sortMode ? '정렬 모드 종료' : '순서 변경 모드'}
                  style={{ color: sortMode ? '#f44336' : selectedCategoryColor }}
                >
                  {sortMode ? <FaTimes /> : <FaArrowsAlt />}
                </button>
              </div>
            )}
          </div>
          {filteredProjects.length === 0 ? (
            <div className="empty-state">프로젝트가 없습니다.</div>
          ) : (
            <div className={`project-grid ${sortMode ? 'sort-mode' : ''}`}>
              {[...filteredProjects].sort((a, b) => (b.number || 0) - (a.number || 0)).map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  categories={categories}
                  onOpen={handleOpenProject}
                  onToggleFavorite={handleToggleFavorite}
                  onEdit={handleEditProject}
                  onDelete={handleDeleteProject}
                  onViewMemo={handleViewMemo}
                  onOpenFolder={handleOpenFolder}
                  onOpenJsonFile={handleOpenJsonFile}
                  isAllowed={isAllowed}
                  sortMode={sortMode}
                  isDragged={draggedProjectId === project.id}
                  isDraggedOver={draggedOverProjectId === project.id}
                  onDragStart={handleDragStart}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onDragEnd={handleDragEnd}
                  copyMode={copyMode}
                  isChecked={copyMode ? selectedProjectsForCopy.includes(project.id) : false}
                  deleteMode={deleteMode}
                  isCheckedForDelete={deleteMode ? selectedProjectsForDelete.includes(project.id) : false}
                  onCheck={handleProjectCheck}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function ProjectCard({ 
  project, 
  onOpen, 
  onToggleFavorite, 
  onEdit, 
  onDelete, 
  onRemoveRecent,
  onViewMemo,
  onOpenFolder,
  onOpenJsonFile,
  isRecent, 
  isAllowed, 
  categories,
  sortMode,
  isDragged,
  isDraggedOver,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
  copyMode,
  isChecked,
  deleteMode,
  isCheckedForDelete,
  onCheck
}) {
  // 프로젝트 색상 또는 카테고리 색상 가져오기
  const getProjectColor = () => {
    if (project.color) {
      return project.color
    }
    // 카테고리 색상 찾기
    const categoryData = categories?.find(c => {
      const catName = typeof c === 'string' ? c : c.name
      return catName === project.category
    })
    if (categoryData) {
      return typeof categoryData === 'string' ? '#667eea' : (categoryData.color || '#667eea')
    }
    return '#667eea'
  }
  
  const projectColor = getProjectColor()
  
  // 정렬 모드, 복사 모드, 삭제 모드일 때는 클릭 이벤트 비활성화
  const handleCardClick = (e) => {
    if (sortMode || copyMode || deleteMode) {
      e.preventDefault()
      e.stopPropagation()
      return
    }
    onOpen(project)
  }
  
  return (
    <div 
      className={`project-card ${!isAllowed ? 'not-allowed' : ''} ${sortMode ? 'draggable' : ''} ${isDragged ? 'dragging' : ''} ${isDraggedOver ? 'drag-over' : ''} ${copyMode && isChecked ? 'checked' : ''} ${deleteMode && isCheckedForDelete ? 'checked' : ''}`}
      draggable={sortMode && isAllowed}
      onDragStart={(e) => onDragStart?.(e, project.id)}
      onDragOver={(e) => onDragOver?.(e, project.id)}
      onDragLeave={onDragLeave}
      onDrop={(e) => onDrop?.(e, project.id)}
      onDragEnd={onDragEnd}
    >
      <div className="project-header">
        <span 
          className="project-index"
          style={{ backgroundColor: projectColor }}
        >
          #{project.index}
        </span>
        {isAllowed && !sortMode && !copyMode && !deleteMode && (
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
            {isRecent && onRemoveRecent && (
              <button
                className="remove-recent-btn"
                onClick={(e) => {
                  e.stopPropagation()
                  onRemoveRecent(project)
                }}
                title="최근 목록에서 제거"
              >
                <FaTimes />
              </button>
            )}
          </div>
        )}
      </div>
      <div
        className="project-content"
        onClick={handleCardClick}
      >
        <h3 className="project-name">{project.name}</h3>
        <p className="project-path">{project.path}</p>
        {project.subcategory && (
          <span 
            className="project-category"
            style={{ backgroundColor: projectColor }}
          >
            {project.subcategory}
          </span>
        )}
        {/* 프로젝트 액션 버튼들 */}
        {isAllowed && !sortMode && !copyMode && !deleteMode && (
          <div className="project-actions-bottom">
            {/* 메모 버튼 - 메모가 있을 때만 표시 */}
            {project.memo && (
              <button
                className="action-btn memo-btn"
                onClick={(e) => {
                  e.stopPropagation()
                  onViewMemo?.(project)
                }}
                title="메모 보기"
              >
                <FaStickyNote />
              </button>
            )}
            {/* 폴더 열기 버튼 - 항상 표시 */}
            <button
              className="action-btn folder-btn"
              onClick={(e) => {
                e.stopPropagation()
                onOpenFolder?.(project)
              }}
              title="폴더 열기"
            >
              <FaFolderOpen />
            </button>
            {/* JSON 파일 열기 버튼 - JSON 경로가 있고 카테고리에서 SFTP 플러그인을 사용할 때만 표시 */}
            {project.jsonPath && (() => {
              const categoryData = categories?.find(c => {
                const catName = typeof c === 'string' ? c : c.name
                return catName === project.category
              })
              const useSftpPlugin = (categoryData && typeof categoryData !== 'string' && categoryData.settings) 
                ? categoryData.settings.useSftpPlugin || false
                : false
              
              return useSftpPlugin && (
                <button
                  className="action-btn json-btn"
                  onClick={(e) => {
                    e.stopPropagation()
                    onOpenJsonFile?.(project)
                  }}
                  title={`${project.jsonPath} 파일 열기`}
                >
                  <FaFileCode />
                </button>
              )
            })()}
          </div>
        )}
      </div>
      {sortMode && isAllowed && (
        <div className="drag-handle">
          <FaGripVertical />
        </div>
      )}
      {copyMode && isAllowed && (
        <label className="project-checkbox checkbox-label" onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={isChecked || false}
            onChange={() => onCheck?.(project.id)}
          />
          <span>
            <FaCheck className="checkbox-icon" />
          </span>
        </label>
      )}
      {deleteMode && isAllowed && (
        <label className="project-checkbox checkbox-label" onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={isCheckedForDelete || false}
            onChange={() => onCheck?.(project.id)}
          />
          <span>
            <FaCheck className="checkbox-icon" />
          </span>
        </label>
      )}
    </div>
  )
}

// 카테고리 설정 컴포넌트
function CategorySettings({ categoryName, categories, onSave, onCancel }) {
  const [defaultEditor, setDefaultEditor] = useState('cursor')
  const [useSftpPlugin, setUseSftpPlugin] = useState(false)

  useEffect(() => {
    // 카테고리 설정 로드
    const categoryData = categories.find(c => {
      const catName = typeof c === 'string' ? c : c.name
      return catName === categoryName
    })

    if (categoryData && typeof categoryData !== 'string' && categoryData.settings) {
      setDefaultEditor(categoryData.settings.defaultEditor || 'cursor')
      setUseSftpPlugin(categoryData.settings.useSftpPlugin || false)
    }
  }, [categoryName, categories])

  const handleSave = () => {
    const settings = {
      defaultEditor,
      useSftpPlugin
    }
    onSave(categoryName, settings)
  }

  return (
    <div className="category-settings">
      <div className="form-group">
        <label>기본 에디터</label>
        <div className="select-wrapper">
          <select
            value={defaultEditor}
            onChange={(e) => setDefaultEditor(e.target.value)}
          >
            <option value="cursor">Cursor</option>
            <option value="vscode">VS Code</option>
          </select>
          <FaChevronDown className="select-arrow" />
        </div>
        <p className="form-help-text">프로젝트 열기 시 사용할 기본 에디터를 선택하세요.</p>
      </div>

      <div className="form-group">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={useSftpPlugin}
            onChange={(e) => setUseSftpPlugin(e.target.checked)}
          />
          <span>
            <FaCheck className="checkbox-icon" />
            SFTP 플러그인 (Natizyskunk) 사용
          </span>
        </label>
        <p className="form-help-text">SFTP 관련 기능 사용 시 이 옵션을 활성화하세요.</p>
      </div>

      <div className="form-actions">
        <button type="button" onClick={onCancel}>
          취소
        </button>
        <button type="button" onClick={handleSave}>
          저장
        </button>
      </div>
    </div>
  )
}

export default App
