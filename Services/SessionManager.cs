using System.IO;

namespace TidalLauncher.Services;

public static class SessionManager
{
    private static readonly string DirectoryPath = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
        "TidalLauncher");

    private static readonly string SessionPath = Path.Combine(DirectoryPath, "session.txt");

    public static void Save(string token)
    {
        Directory.CreateDirectory(DirectoryPath);
        File.WriteAllText(SessionPath, token);
    }

    public static string? Load()
    {
        try
        {
            if (!File.Exists(SessionPath))
                return null;

            var token = File.ReadAllText(SessionPath).Trim();
            return string.IsNullOrWhiteSpace(token) ? null : token;
        }
        catch
        {
            return null;
        }
    }

    public static void Logout()
    {
        try
        {
            if (File.Exists(SessionPath))
                File.Delete(SessionPath);
        }
        catch
        {
            // The launcher can still continue even if the local session file cannot be removed.
        }
    }
}
