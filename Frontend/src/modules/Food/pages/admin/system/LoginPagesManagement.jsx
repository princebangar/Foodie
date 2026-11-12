import { useEffect, useRef, useState } from "react"
import { Bike, ImagePlus, Loader2, Store, Trash2, User } from "lucide-react"
import { toast } from "sonner"
import api from "@food/api"
import { Button } from "@food/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@food/components/ui/dialog"
import { prepareUploadFiles } from "@/shared/utils/imageCompressor"

const MAX_IMAGES = 5

const APP_TABS = [
  { key: "user", label: "User", icon: User, live: true },
  { key: "restaurant", label: "Restaurant", icon: Store, live: false },
  { key: "delivery", label: "Delivery", icon: Bike, live: false },
]

const errorMessage = (error, fallback) =>
  error?.response?.data?.message || error?.message || fallback

export default function LoginPagesManagement() {
  const [appType, setAppType] = useState("user")
  const [images, setImages] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [imageToDelete, setImageToDelete] = useState(null)
  const fileInputRef = useRef(null)

  const activeTab = APP_TABS.find((tab) => tab.key === appType)
  const baseUrl = `/food/admin/login-pages/${appType}/images`
  const remaining = MAX_IMAGES - images.length

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setImages([])
    api
      .get(`/food/admin/login-pages/${appType}/images`)
      .then((res) => {
        if (!cancelled) setImages(res?.data?.data?.images || [])
      })
      .catch((error) => {
        if (!cancelled) toast.error(errorMessage(error, "Failed to load images"))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [appType])

  // Every change returns the saved list, so the page always shows what the app will show.
  const runChange = async (request, successMessage, fallbackError) => {
    setBusy(true)
    try {
      const res = await request()
      setImages(res?.data?.data?.images || [])
      toast.success(successMessage)
      return true
    } catch (error) {
      toast.error(errorMessage(error, fallbackError))
      return false
    } finally {
      setBusy(false)
    }
  }

  const handleFilesSelected = async (event) => {
    const files = Array.from(event.target.files || [])
    event.target.value = ""
    if (!files.length) return

    if (files.length > remaining) {
      toast.error(`You can add only ${remaining} more image(s). The limit is ${MAX_IMAGES}.`)
      return
    }

    setBusy(true)
    const prepared = await prepareUploadFiles(files)
    const formData = new FormData()
    prepared.forEach((file) => formData.append("files", file))
    await runChange(
      () => api.post(baseUrl, formData, { headers: { "Content-Type": "multipart/form-data" } }),
      "Images uploaded",
      "Failed to upload images",
    )
  }

  const handleOrderChange = (image, newPosition) => {
    const orderedIds = images.filter(({ _id }) => _id !== image._id).map(({ _id }) => _id)
    orderedIds.splice(newPosition - 1, 0, image._id)
    runChange(
      () => api.patch(`${baseUrl}/order`, { orderedIds }),
      "Order updated",
      "Failed to update order",
    )
  }

  const handleConfirmDelete = async () => {
    const deleted = await runChange(
      () => api.delete(`${baseUrl}/${imageToDelete._id}`),
      "Image deleted",
      "Failed to delete image",
    )
    if (deleted) setImageToDelete(null)
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 lg:p-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">All Login Pages</h1>
          </div>
          <p className="mt-1 text-sm text-slate-600">
            Choose the images shown in the login page slider of each app, and the order they appear in.
          </p>
        </div>

        <div role="tablist" aria-label="App" className="mb-6 flex flex-wrap gap-2">
          {APP_TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={appType === key}
              disabled={busy}
              onClick={() => setAppType(key)}
              className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed ${
                appType === key
                  ? "border-[#B80B3D] bg-[#B80B3D] text-white"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                {activeTab.label} login page
                <span className="ml-2 text-sm font-medium text-slate-500">
                  {images.length} of {MAX_IMAGES} images
                </span>
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Portrait images work best: 1080 × 1440 px, with text near the top.
              </p>
              {!activeTab.live && (
                <p className="mt-1 text-sm text-amber-700">
                  These images are saved, but the {activeTab.label.toLowerCase()} app's login page doesn't show them yet.
                </p>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={handleFilesSelected}
              className="hidden"
            />
            <Button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={busy || loading || remaining <= 0}
              className="bg-[#B80B3D] text-white hover:bg-[#90082E]"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
              {remaining <= 0 ? "Limit reached" : "Upload images"}
            </Button>
          </div>

          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="h-7 w-7 animate-spin text-slate-400" />
            </div>
          ) : images.length === 0 ? (
            <div className="rounded-lg border-2 border-dashed border-slate-200 py-16 text-center">
              <ImagePlus className="mx-auto h-9 w-9 text-slate-300" />
              <p className="mt-3 text-sm font-medium text-slate-700">No images yet</p>
              <p className="mt-1 text-sm text-slate-500">
                Upload up to {MAX_IMAGES} images for this login page.
              </p>
            </div>
          ) : (
            <ul className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
              {images.map((image, index) => (
                <li key={image._id} className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                  <div className="relative aspect-[3/4] bg-slate-900">
                    <img
                      src={image.imageUrl}
                      alt={`Login slide ${index + 1}`}
                      className="h-full w-full object-cover object-top"
                    />
                    <button
                      type="button"
                      onClick={() => setImageToDelete(image)}
                      disabled={busy}
                      aria-label={`Delete image ${index + 1}`}
                      className="absolute right-2 top-2 rounded-md bg-white/95 p-1.5 text-red-600 shadow hover:bg-white disabled:opacity-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <label className="flex items-center justify-between gap-2 p-2.5 text-sm font-medium text-slate-700">
                    Order
                    <select
                      value={index + 1}
                      disabled={busy || images.length < 2}
                      onChange={(event) => handleOrderChange(image, Number(event.target.value))}
                      className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm disabled:bg-slate-100"
                    >
                      {images.map((_, optionIndex) => (
                        <option key={optionIndex} value={optionIndex + 1}>
                          {optionIndex + 1}
                        </option>
                      ))}
                    </select>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <Dialog
        open={Boolean(imageToDelete)}
        onOpenChange={(open) => {
          if (!open && !busy) setImageToDelete(null)
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete this image?</DialogTitle>
            <DialogDescription>
              It will be removed from the {activeTab.label.toLowerCase()} login page. This can't be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-2 flex justify-end gap-2">
            <Button type="button" variant="outline" disabled={busy} onClick={() => setImageToDelete(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={busy}
              onClick={handleConfirmDelete}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
