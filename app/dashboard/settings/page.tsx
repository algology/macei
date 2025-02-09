"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Download, Trash2, Upload } from "lucide-react";
import Image from "next/image";
import { DashboardLayout } from "@/app/components/DashboardLayout";

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    async function fetchProfile() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }

      setUser(session.user);

      // Set initial name from user metadata if available
      const initialName = session.user.user_metadata?.full_name || "";
      setFullName(initialName);

      // Try to fetch existing profile
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .single();

      if (error && error.code === "PGRST116") {
        // Profile doesn't exist, create it
        const { error: createError } = await supabase.from("profiles").insert({
          id: session.user.id,
          full_name: initialName,
          updated_at: new Date(),
        });

        if (createError) {
          console.error("Error creating profile:", createError);
        }
      } else if (profile) {
        // Profile exists, use its data
        setFullName(profile.full_name || initialName);
        setAvatarUrl(profile.avatar_url);
      }

      setLoading(false);
    }

    fetchProfile();
  }, [router]);

  const handleAvatarUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    try {
      setUploading(true);

      if (!event.target.files || event.target.files.length === 0) {
        throw new Error("You must select an image to upload.");
      }

      const file = event.target.files[0];
      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}-${Math.random()
        .toString(36)
        .substring(2)}.${fileExt}`;
      const filePath = fileName;

      // Upload image to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      if (urlData) {
        // Update profile with new avatar URL
        const { error: updateError } = await supabase.from("profiles").upsert({
          id: user.id,
          avatar_url: urlData.publicUrl,
          updated_at: new Date().toISOString(),
        });

        if (updateError) throw updateError;

        // Update local state immediately
        setAvatarUrl(urlData.publicUrl);

        // Update user metadata
        await supabase.auth.updateUser({
          data: { avatar_url: urlData.publicUrl },
        });
      }
    } catch (error) {
      alert("Error uploading avatar!");
      console.log(error);
    } finally {
      setUploading(false);
    }
  };

  const handleUpdateProfile = async () => {
    try {
      setLoading(true);

      // Update user metadata
      const { error: userError } = await supabase.auth.updateUser({
        data: { full_name: fullName },
      });

      if (userError) throw userError;

      // Update profile
      const { error: profileError } = await supabase.from("profiles").upsert({
        id: user.id,
        full_name: fullName,
        updated_at: new Date().toISOString(),
      });

      if (profileError) throw profileError;

      alert("Profile updated successfully!");
    } catch (error) {
      console.error("Error updating profile:", error);
      alert("Error updating profile!");
    } finally {
      setLoading(false);
    }
  };

  if (loading) return null;

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto py-8 px-4">
        <h1 className="text-2xl font-bold mb-8">Settings</h1>

        {/* Profile Section */}
        <section className="mb-12">
          <h2 className="text-lg font-semibold mb-4">Profile</h2>
          <div className="space-y-6 bg-accent-1/50 border border-accent-2 rounded-lg p-6">
            {/* Avatar Upload */}
            <div className="flex items-center gap-6">
              <div className="relative">
                {avatarUrl ? (
                  <Image
                    src={avatarUrl}
                    alt="Avatar"
                    width={80}
                    height={80}
                    className="rounded-full w-20 h-20 object-cover"
                  />
                ) : (
                  <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center text-black font-medium text-xl">
                    {user.email?.[0].toUpperCase()}
                  </div>
                )}
                <label className="absolute bottom-0 right-0 p-1 bg-accent-1 border border-accent-2 rounded-full cursor-pointer hover:bg-accent-2">
                  <Upload className="w-4 h-4" />
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    disabled={uploading}
                  />
                </label>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">
                  Full Name
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="px-4 py-2 bg-accent-1 border border-accent-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="Enter your name"
                />
              </div>
            </div>
            <button
              onClick={handleUpdateProfile}
              className="px-4 py-2 bg-green-500/20 text-green-400 rounded-lg border border-green-900 hover:bg-green-500/30"
            >
              Save Changes
            </button>
          </div>
        </section>

        {/* Account Management */}
        <section>
          <h2 className="text-lg font-semibold mb-4">Account Management</h2>
          <div className="space-y-4 bg-accent-1/50 border border-accent-2 rounded-lg p-6">
            <button className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-accent-1 rounded-lg border border-accent-2 hover:bg-accent-2">
              <Download className="w-4 h-4" />
              Export Account Data
            </button>
            <button
              onClick={async () => {
                const confirmed = window.confirm(
                  "Are you sure you want to delete your account? This action cannot be undone."
                );
                if (confirmed) {
                  try {
                    const { error } = await supabase.rpc("delete_user_account");
                    if (error) throw error;
                    await supabase.auth.signOut();
                    router.push("/");
                  } catch (error) {
                    alert("Error deleting account!");
                    console.log(error);
                  }
                }
              }}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-500/20 text-red-400 rounded-lg border border-red-900 hover:bg-red-500/30"
            >
              <Trash2 className="w-4 h-4" />
              Delete Account
            </button>
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}
